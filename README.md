# RAG Backend Server Documentation

## Overview
The RAG Backend Server is designed to serve as the backend for the RAG (Retrieve, Answer, Generate) web application. It handles API requests, manages database interactions, and serves data to the frontend.

## Features
- **API Endpoints**
  - Handles requests to various API endpoints for fetching data.
  - Supports a range of functionalities for managing user interactions and content.

- **Environment Variables**
  - Uses environment variables for sensitive configuration.
  - Supports configurations for different environments (development, production).

## Setup Instructions
1. **Clone the Repository**
   ```bash
   git clone https://github.com/AbhiShekPaulJ/Rag-Extension-BACKEND.git
   cd Rag-Extension-BACKEND
   ```

2. **Install Dependencies**
   Make sure you have [Node.js](https://nodejs.org/) installed, then:
   ```bash
   npm install
   ```

3. **Set Environment Variables**
   - Create a `.env` file at the root of the project and configure the following variables:
     ```
     AZURE_OPENAI_KEY=KEY
     PORT=PORT_NUMBER
     CHROME_EXTENSION_ID=your-extention-id
     ```

4. **Start the Server**
   ```bash
   npm start
   ```
   The server will start running on `http://localhost:3000`.

## API Endpoints
### 1. User Authentication
- **POST** `/api/auth/login`
  - Login a user.
  - Request body: `{
    "username": "user",
    "password": "pass"
  }`

- **POST** `/api/auth/register`
  - Register a new user.
  - Request body: `{
    "username": "newuser",
    "password": "newpass"
  }`

### 2. Data Retrieval
- **GET** `/api/data`
  - Fetch all data entries.

### 3. Data Updates
- **PUT** `/api/data/:id`
  - Update data entry.
  - Request body: `{
    "field": "value"
  }`

## Conclusion
The RAG Backend Server is an essential component of the RAG application, providing all necessary backend functionalities. Follow the setup instructions to get started with the development and contribute to enhancing the server functionalities.
