import logging
import string
import traceback
import random
import sqlite3
from datetime import datetime
from flask import * # Flask, g, redirect, render_template, request, url_for
from functools import wraps

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

def get_db():
    db = getattr(g, '_database', None)

    if db is None:
        db = g._database = sqlite3.connect('db/watchparty.sqlite3')
        db.row_factory = sqlite3.Row
        setattr(g, '_database', db)
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def query_db(query, args=(), one=False):
    db = get_db()
    cursor = db.execute(query, args)
    rows = cursor.fetchall()
    db.commit()
    cursor.close()
    if rows:
        if one:
            return rows[0]
        return rows
    return None

def new_user():
    name = "Unnamed User #" + ''.join(random.choices(string.digits, k=6))
    password = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
    api_key = ''.join(random.choices(string.ascii_lowercase + string.digits, k=40))
    u = query_db('insert into users (name, password, api_key) ' +
        'values (?, ?, ?) returning id, name, password, api_key',
        (name, password, api_key),
        one=True)
    return u

# TODO: If your app sends users to any other routes, include them here.
#       (This should not be necessary).
# Define the root route and several other routes that will serve the same static HTML file
@app.route('/')
@app.route('/profile')
@app.route('/login')
@app.route('/room')
@app.route('/room/<chat_id>')
def index(chat_id=None):  # 'chat_id' is optional and defaults to None
 # Serve the 'index.html' static file to the client for these routes
    return app.send_static_file('index.html')

# Define a custom error handler for 404 errors (page not found)
@app.errorhandler(404)
def page_not_found(e):
    return app.send_static_file('404.html'), 404

# -------------------------------- API ROUTES ----------------------------------

# TODO: Create the API

# Define a route for the signup process, accepting POST requests
@app.route('/api/signup', methods=['POST'])
def signUp():
    # Create a new user
    newUser = new_user()
    # Return a JSON response with the user's ID, name, and API key
    return jsonify({
        "user_id": newUser["id"],
        "user_name": newUser["name"],
        "api_key": newUser["api_key"],
    }), 200  # Status code 200 OK

# Define a route for the login process, accepting POST requests
@app.route('/api/login', methods=['POST'])
def logIn():
    # Extract username and password from the JSON body of the request
    userName = request.json.get('userName')
    password = request.json.get('password')
    # Query the database for a user matching the provided username and password
    user = query_db('select * from users where name = ? and password = ?', [userName, password], one=True)
    if user:
        # If a user is found, return their ID, name, and API key
        return jsonify({
            "user_id": user["id"],
            "user_name": user["name"],
            "api_key": user["api_key"],
        }), 200  # Status code 200 OK

    # If no user is found, return an error message
    return jsonify({"error": "not login"}), 500  # Status code 500 Internal Server Error

# Decorator to enforce API key requirement for certain routes
def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Retrieve the API key from the request headers
        api_key = request.headers.get('Authorization')
        print("Received API Key:", api_key)
        if not api_key:
            # If no API key is provided, return an error
            return jsonify({"error": "API key required"}), 403  # Status code 403 Forbidden
        # Query the database for a user with the provided API key
        user = query_db('SELECT * FROM users WHERE api_key = ?', [api_key], one=True)
        print("User found:", user)
        if not user:
            # If no user is found, return an error
            return jsonify({"error": "Invalid API key"}), 403  # Status code 403 Forbidden
        return f(*args, **kwargs)
    return decorated_function

# Define a route for updating a user's name, accepting POST requests and requiring an API key
@app.route('/api/user/name', methods=['POST'])
@require_api_key
def update_username():
    data = request.json
    # Update the user's name in the database using the provided API key
    query_db('UPDATE users SET name = ? WHERE api_key = ?', [data['new_name'], request.headers.get('Authorization')])
    # Return a success message
    return jsonify({"message": "Username updated successfully"}), 200  # Status code 200 OK

# Define a route for changing a user's password, accepting POST requests and requiring an API key
@app.route('/api/user/password', methods=['POST'])
@require_api_key
def update_password():
    data = request.json
    # Update the user's password in the database using the provided API key
    query_db('UPDATE users SET password = ? WHERE api_key = ?', [data['new_password'], request.headers.get('Authorization')])
    # Return a success message
    return jsonify({"message": "Password updated successfully"}), 200  # Status code 200 OK

# Define a route for creating a new room, accepting POST requests and requiring an API key
@app.route('/api/rooms/new', methods = ['POST'])
@require_api_key
def create_room():
    print("create room")
    # Generate a random name for the new room
    name = "Unnamed Room " + ''.join(random.choices(string.digits, k=6))
    # Insert the new room into the database and return its ID
    room = query_db('insert into rooms (name) values (?) returning id', [name], one=True)
    # Return the room's ID and name
    return jsonify({
        'id': room['id'],
        'name': name,
    }), 200  # Status code 200 OK

# Define a route for retrieving all rooms, accepting GET requests and requiring an API key
@app.route('/api/rooms', methods = ['GET'])
@require_api_key
def get_all_room():
    # Query the database for all rooms
    rooms = query_db(query = 'select * from rooms')

    roomList = []
    for room in rooms:
        # For each room, add its ID and name to the list
        room_info = {"room_id": room["id"], "room_name": room["name"]}
        roomList.append(room_info)

    # Return the list of rooms
    return jsonify(roomList), 200  # Status code 200 OK

# Define a route for retrieving the name of a specific room, accepting GET requests and requiring an API key
@app.route('/api/rooms/<int:room_id>', methods = ['GET'])
@require_api_key
def get_room_name(room_id):
    # Query the database for the room with the specified ID
    room = query_db('select * from rooms where id = ?', [room_id], one = True)
    if room:
        # If the room is found, return its ID and name
        theRoom = {"room_id": room["id"], "room_name": room["name"]}
        return jsonify(theRoom), 200  # Status code 200 OK
    # If the room is not found, return an error message
    return jsonify({"error": "Failed to get rooms"}), 500  # Status code 500 Internal Server Error

# Define a route for updating a room's name, accepting POST requests and requiring an API key
@app.route('/api/rooms/name', methods=['POST'])
@require_api_key
def change_room_name():
    data = request.json
    # Update the room's name in the database using the provided room ID
    query_db('UPDATE rooms SET name = ? WHERE id = ?', [data['new_name'], data['room_id']])
    # Return a success message
    return jsonify({"message": "Room name updated successfully"}), 200  # Status code 200 OK

# Define a route for retrieving messages in a specific room, accepting GET requests and requiring an API key
@app.route('/api/rooms/<int:room_id>/messages', methods=['GET'])
@require_api_key
def get_messages(room_id):
    messages = query_db('''
        SELECT messages.id, users.name as author, messages.body
        FROM messages
        JOIN users ON messages.user_id = users.id
        WHERE room_id = ?''',
        [room_id])
    # Return the messages as a list of dictionaries
    return jsonify([dict(msg) for msg in messages]), 200  # Status code 200 OK

# Define a route for posting a message in a specific room, accepting POST requests and requiring an API key
@app.route('/api/rooms/<int:room_id>/messages', methods=['POST'])
@require_api_key
def post_message(room_id):
    data = request.json
    query_db('INSERT INTO messages (user_id, room_id, body) VALUES (?, ?, ?)', [data['user_id'], room_id, data['body']])
    # Return a success message
    return jsonify({"message": "Message posted successfully"}), 200  # Status code 200 OK

