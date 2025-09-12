
import socket
import os
import openai
import requests
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import logging

# --- Load local.settings.json if running locally ---
if os.path.exists("local.settings.json"):
    with open("local.settings.json", "r") as f:
        settings = json.load(f)
        for k, v in settings.get("Values", {}).items():
            if v and not os.environ.get(k):
                os.environ[k] = v

# Load Azure OpenAI config from environment variables
AZURE_OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_CHAT_DEPLOYMENT = os.environ.get("AZURE_OPENAI_CHAT_DEPLOYMENT")
AZURE_OPENAI_API_VERSION = os.environ.get(
    "AZURE_OPENAI_API_VERSION", "2023-07-01-preview")


logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Coffee TTS/STT API", root_path="/api")
# Enable CORS for all origins (for local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
host = socket.gethostname()
port = os.environ.get('PORT', 7071)
logging.info(
    f"[API] Coffee TTS/STT API server is starting with root_path='/api' ...")
logging.info(f"[API] Full API base URL: http://localhost:{port}/api/")
# Debug: print all loaded environment variables (mask secrets)
for k, v in os.environ.items():
    if any(s in k.lower() for s in ["key", "password", "token"]):
        display_v = v[:4] + "..." if v else ""
    else:
        display_v = v
    logging.info(f"[API] ENV {k} = {display_v}")

    # ICE server token endpoint for WebRTC


@app.post("/get-ice-server-token")
@app.get("/get-ice-server-token")
def get_ice_server_token(request: Request):
    logging.info('FastAPI get-ice-server-token endpoint called.')
    region = os.getenv("AZURE_SPEECH_REGION")
    subscription_key = os.getenv("AZURE_SPEECH_API_KEY")
    token_endpoint = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1"
    response = requests.get(token_endpoint, headers={
                            "Ocp-Apim-Subscription-Key": subscription_key})
    if response.status_code == 200:
        return JSONResponse(
            content=response.json(),
            status_code=200,
            headers={"Content-Type": "application/json"}
        )
    else:
        return JSONResponse(content={"error": f"Failed to fetch ICE server token: {response.status_code}"}, status_code=response.status_code)


# --- Speech Token Endpoint ---
@app.get("/get-speech-token")
def get_speech_token(request: Request):
    logging.info(
        f"[API] Processing {request.url.path} (full URL: {request.url})")
    speech_key = os.environ.get("AZURE_SPEECH_API_KEY")
    speech_region = os.environ.get("AZURE_SPEECH_REGION")
    if not speech_key or not speech_region:
        logging.warning("[API] Speech API key or region not set.")
        return {"error": "Speech API key or region not set."}
    fetch_url = f"https://{speech_region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    headers = {"Ocp-Apim-Subscription-Key": speech_key, "Content-Length": "0"}
    response = requests.post(fetch_url, headers=headers)
    if response.status_code == 200:
        logging.info("[API] Speech token issued successfully.")
        return {"token": response.text, "region": speech_region}
    else:
        logging.error(
            f"[API] Failed to fetch speech token. Status: {response.status_code}")
        return {"error": "Failed to fetch speech token.", "status": response.status_code}

# --- Data Models ---


class CoffeeItem(BaseModel):
    coffeeType: str
    size: str
    quantity: int = 1
    syrups: List[str] = []
    shotType: Optional[str] = "Single"
    milkType: str


class CoffeeOrder(BaseModel):
    orderId: str
    customerName: str
    coffeeItems: List[CoffeeItem]
    status: str
    createdAt: str
    estimatedTime: str


# --- In-memory store ---
ORDERS = {}

# --- Helper Functions ---


def generate_order_id():
    return f"ORD-{1000 + len(ORDERS) + 1}"


def estimate_time(total_items):
    return f"{5 + total_items + (total_items // 2)} minutes"

# --- OpenAI Function Calling Tools ---


def get_menu():
    with open(os.path.join(os.path.dirname(__file__), "menu.json"), "r") as f:
        menu = json.load(f)
    return menu


def order_coffee(customerName: str, coffeeItems: list):
    # Simulate placing an order (reuse place_order logic)
    order = {"customerName": customerName, "coffeeItems": coffeeItems}
    return place_order(order)


def company_info(query: str = None):
    return app.openapi().get("info", {})

# --- API Endpoints ---
# --- OpenAI Streaming Endpoint ---


@app.post("/get-oai-response")
async def get_oai_response(request: Request):
    logging.info(
        f"[API] Processing {request.url.path} (full URL: {request.url})")
    body = await request.json()
    logging.info(f"[API] /get-oai-response request body: {body}")
    messages = body.get("messages", [])
    functions = [
        {
            "name": "order_coffee",
            "description": "Place a coffee order for a customer.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customerName": {"type": "string", "description": "Name of the customer."},
                    "coffeeItems": {"type": "array", "items": {"type": "object"}, "description": "List of coffee items."}
                },
                "required": ["customerName", "coffeeItems"]
            }
        },
        {
            "name": "get_menu",
            "description": "Get the coffee menu.",
            "parameters": {"type": "object", "properties": {}}
        },
        {
            "name": "company_info",
            "description": "Get information about the coffee company.",
            "parameters": {"type": "object", "properties": {"query": {"type": "string", "description": "Query about company info."}}}
        }
    ]

    def stream_openai():
        openai.api_type = "azure"
        openai.api_base = AZURE_OPENAI_ENDPOINT
        openai.api_key = AZURE_OPENAI_API_KEY
        openai.api_version = AZURE_OPENAI_API_VERSION
        try:
            response = openai.ChatCompletion.create(
                engine=AZURE_OPENAI_CHAT_DEPLOYMENT,
                messages=messages,
                functions=functions,
                stream=True,
            )
            for chunk in response:
                logging.info(
                    f"[API] /get-oai-response streaming chunk: {chunk}")
                # Ensure each chunk is a single line, no extra whitespace
                yield json.dumps(chunk, separators=(",", ":")) + "\n"
        except Exception as e:
            logging.error(f"OpenAI API error: {e}")
            yield json.dumps({"error": str(e)}) + "\n"

    return StreamingResponse(stream_openai(), media_type="application/json")


@app.post("/order", response_model=CoffeeOrder)
def place_order(order: dict, request: Request):
    logging.info(
        f"[API] Processing {request.url.path} (full URL: {request.url})")
    customerName = order.get("customerName")
    coffeeItems = [CoffeeItem(**item) for item in order.get("coffeeItems", [])]
    if not customerName or not coffeeItems:
        raise HTTPException(
            status_code=400, detail="Missing customerName or coffeeItems")
    orderId = generate_order_id()
    total_items = sum(item.quantity for item in coffeeItems)
    estimatedTime = estimate_time(total_items)
    new_order = CoffeeOrder(
        orderId=orderId,
        customerName=customerName,
        coffeeItems=coffeeItems,
        status="pending",
        createdAt=datetime.now().isoformat(),
        estimatedTime=estimatedTime
    )
    ORDERS[orderId] = new_order
    return new_order


@app.get("/order/{order_id}", response_model=CoffeeOrder)
def get_order(order_id: str, request: Request):
    logging.info(
        f"[API] Processing {request.url.path} (full URL: {request.url})")
    order = ORDERS.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@app.patch("/order/{order_id}", response_model=CoffeeOrder)
def update_order(order_id: str, update: dict, request: Request):
    logging.info(
        f"[API] Processing {request.url.path} (full URL: {request.url})")
    order = ORDERS.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    # Only allow updating status or coffeeItems
    if "status" in update:
        order.status = update["status"]
    if "coffeeItems" in update:
        order.coffeeItems = [CoffeeItem(**item)
                             for item in update["coffeeItems"]]
    ORDERS[order_id] = order
    return order


@app.delete("/order/{order_id}")
def cancel_order(order_id: str, request: Request):
    logging.info(
        f"[API] Processing {request.url.path} (full URL: {request.url})")
    order = ORDERS.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = "cancelled"
    ORDERS[order_id] = order
    return {"success": True, "message": f"Order {order_id} cancelled."}


@app.get("/orders", response_model=List[CoffeeOrder])
def list_orders(request: Request):
    logging.info(
        f"[API] Processing {request.url.path} (full URL: {request.url})")
    return list(ORDERS.values())


@app.get("/company-info")
def company_info(query: Optional[str] = None, request: Request = None):
    if request:
        logging.info(
            f"[API] Processing {request.url.path} (full URL: {request.url})")
    company = {
        "name": "CoffeeCorp",
        "founded": 2010,
        "description": "A specialty coffee company focused on ethically sourced coffee beans, innovative brewing methods, and premium cafe experiences.",
        "services": [
            "Specialty Coffee Production",
            "Coffee Subscription Service",
            "Barista Training Programs",
            "Coffee Shop Franchising",
        ],
        "partnerships": ["Fair Trade Certified", "Rainforest Alliance"],
        "mission": "To elevate the coffee experience through sustainability, quality, and innovation",
        "contact": {
            "email": "contact@coffeecorp.com",
            "phone": "+1-800-COFFEE-1",
            "website": "www.coffeecorp.com",
        },
    }
    if not query:
        return company
    q = query.lower()
    if "service" in q or "offer" in q:
        return {"info": f"CoffeeCorp offers {', '.join(company['services'])}."}
    if "contact" in q or "reach" in q:
        return {"info": f"You can contact CoffeeCorp at {company['contact']['email']} or {company['contact']['phone']}."}
    if "mission" in q or "goal" in q:
        return {"info": company['mission']}
    if "partner" in q:
        return {"info": f"CoffeeCorp is partnered with {', '.join(company['partnerships'])}."}
    return {"info": f"{company['name']} is {company['description']}"}


@app.get("/health")
def health(request: Request):
    logging.info(
        f"[API] Processing {request.url.path} (full URL: {request.url})")
    return {"status": "ok"}
