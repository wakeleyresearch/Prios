#!/bin/bash

# Productivity Visualization System Launcher

echo "=================================="
echo "Productivity Trajectory Analysis"
echo "=================================="
echo ""

# Check Python installation
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    exit 1
fi

# Install dependencies if needed
echo "Checking Python dependencies..."
python3 -c "import numpy, scipy, pandas, sklearn" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Installing required Python packages..."
    pip install numpy scipy pandas scikit-learn
fi

# Generate fresh data
echo ""
echo "Generating productivity data..."
python3 productivity_system.py

# Check if data was generated successfully
if [ -f "productivity_data.json" ]; then
    echo ""
    echo "✓ Data generated successfully!"
else
    echo "✗ Failed to generate data"
    exit 1
fi

# Try to open the visualization
echo ""
echo "Opening visualization..."

# Detect OS and open browser
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open productivity-parallel-coords.html 2>/dev/null &
elif [[ "$OSTYPE" == "darwin"* ]]; then
    open productivity-parallel-coords.html
elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    start productivity-parallel-coords.html
else
    echo "Please open productivity-parallel-coords.html in your browser"
fi

echo ""
echo "=================================="
echo "System launched successfully!"
echo "=================================="
echo ""
echo "Tips:"
echo "• Adjust the opacity slider to see patterns more clearly"
echo "• Click 'Detect Patterns' to analyze productivity states"
echo "• Drag on any axis to filter the data"
echo "• Check the stats panel for real-time metrics"
echo ""