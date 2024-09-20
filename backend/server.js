const express = require('express');
const multer = require('multer');
const path = require('path');
const tesseract = require('tesseract.js');
const mongoose = require('mongoose');
const cors = require('cors');
const Card = require('./models/Card');
require('dotenv').config();

// Initialize Express app
const app = express();

// Enable CORS for all routes (allows cross-origin requests)
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware to serve static files from the "uploads" folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure file upload using Multer
const upload = multer({ dest: 'uploads/' });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// Endpoint to handle image upload and OCR processing
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { path: filePath, filename } = req.file;

    // Process the image using Tesseract.js
    const { data: { text } } = await tesseract.recognize(filePath, 'eng', {
      logger: (m) => console.log(), // Logs OCR process for debugging
    });

    // Parse the text to extract specific fields (name, email, etc.)
    const extractedData = parseText(text);

    // Save the extracted data along with the uploaded image to MongoDB
    const newCard = new Card({
      ...extractedData,
      image: `/uploads/${filename}`,  // Store the relative path to the uploaded image
    });
    await newCard.save();

    // Respond with the extracted data
    res.json(extractedData);
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// Function to parse text and extract relevant information
const parseText = (text) => {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  const nameRegex = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/;
  const jobTitleRegex = /\b(?:Manager|Engineer|Developer|Consultant|Director|Designer|Officer|CEO|CTO|CFO|President|Vice President)\b/i;
  const companyNameRegex = /\b[A-Z][a-zA-Z]*(?:\s[A-Z][a-zA-Z]*)*\b/;
  const addressRegex = /\d{1,5}\s\w+\s(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl)\b/i;

  const extractedData = {
    name: '',
    jobTitle: '',
    companyName: '',
    email: '',
    phoneNumber: '',
    address: ''
  };

  lines.forEach((line) => {
    if (!extractedData.email && emailRegex.test(line)) {
      extractedData.email = line.match(emailRegex)[0];
    }
    if (!extractedData.phoneNumber && phoneRegex.test(line)) {
      extractedData.phoneNumber = line.match(phoneRegex)[0];
    }
    if (!extractedData.name && nameRegex.test(line)) {
      extractedData.name = line.match(nameRegex)[0];
    }
    if (!extractedData.jobTitle && jobTitleRegex.test(line)) {
      extractedData.jobTitle = line.match(jobTitleRegex)[0];
    }
    if (!extractedData.companyName && companyNameRegex.test(line)) {
      extractedData.companyName = line.match(companyNameRegex)[0];
    }
    if (!extractedData.address && addressRegex.test(line)) {
      extractedData.address = line.match(addressRegex)[0];
    }
  });

  return extractedData;
};

// Endpoint to retrieve all stored cards with pagination
app.get('/cards', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const cards = await Card.find()
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json(cards);
  } catch (error) {
    console.error('Error retrieving cards:', error);
    res.status(500).json({ error: 'Failed to retrieve cards' });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
