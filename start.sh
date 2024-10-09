#!/bin/bash
# Install Python dependencies
pip install -r requirements.txt

# Start the Node.js application in the background
node kostrackerr.js &

# Start the Python application
python kostracker.py