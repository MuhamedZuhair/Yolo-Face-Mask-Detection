# Face Mask Detection System 

A comprehensive face mask detection system using YOLOv8 with a modern web interface. This application can detect people wearing masks correctly, incorrectly, or not at all.

## Contributors & Roles 👥

| Role                  | Contributor                                                  | Description |
|-----------------------|--------------------------------------------------------------|-------------|
| **AI Model**          | [ MuhamedZuhair ](https://github.com/MuhamedZuhair)               | Trained and fine-tuned the YOLOv8 model for face mask detection. |
| **Model Deployment**  | [ HossamٍSalah ](https://github.com/HossamCSE)                     | Deployed the YOLOv8 model into a production-ready environment. |
| **Data Preparation**  | [ MuhamedZuhair](https://github.com/HossamCSE)                     | Collected, cleaned, and prepared datasets for optimal model performance. |
| **Testing & QA**      | [ MuhamedZuhair] & [ HossamٍSalah ]                    | Validated model accuracy and ensured stable API performance. |


## Features 

### 📷 Image Upload
- **Drag & Drop Support**: Simply drag images into the upload area
- **Multiple Format Support**: JPG, PNG, JPEG
- **Batch Processing**: Upload and process multiple images at once
- **Real-time Results**: View detection results with bounding boxes and confidence scores
- **Cropped Face Display**: See individual detected faces with classifications

### 🎥 Live Camera
- **Real-time Camera Feed**: Access your device camera through the browser
- **Instant Capture**: Take photos and get immediate mask detection results
- **Camera Controls**: Easy start/stop functionality
- **Live Processing**: Process captured images in real-time

### ⏰ Automatic Monitoring
- **Scheduled Captures**: Automatically capture images at set intervals (30s, 1min, 2min, 5min)
- **Continuous Monitoring**: Long-term surveillance capability
- **Sound Alerts**: Audio notifications when unmasked persons are detected
- **Historical Data**: Keep track of all monitoring sessions
- **Statistics Tracking**: Real-time statistics of detections

### 📊 Advanced Analytics
- **Detection Statistics**: Real-time counts of masked/unmasked/incorrectly masked individuals
- **Performance Metrics**: Track API response times and success rates
- **Export Functionality**: Download results in JSON or CSV format
- **Visual Feedback**: Modern, responsive UI with smooth animations

## Installation & Setup 

### Prerequisites
- Python 3.8 or higher
- Node.js (for development)
- Webcam (for camera features)

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd face-mask-detection
```

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Download or Train Your Model
Place your trained YOLOv8 model file (`best_yolo_for_mask_detection.pt`) in the project root directory.

If you don't have a trained model, the system will automatically use a pretrained YOLOv8 model as fallback.

### 4. Run the Flask Server
```bash
python app.py
```

The server will start on `http://localhost:5000`

### 5. Open the Web Interface
Open your browser and navigate to `http://localhost:5000`

## Project Structure 📁

```
face-mask-detection/
├── app.py                          # Flask server with YOLO integration
├── requirements.txt                # Python dependencies
├── best_yolo_for_mask_detection.pt # Your trained YOLO model
├── templates/
│   └── index.html                  # Main HTML interface
├── static/
│   ├── styles.css                  # Styling and animations
│   ├── script.js                   # Original JavaScript
│   └── script_with_api.js          # Enhanced JavaScript with API integration
└── README.md                       # This file
```

## API Endpoints 

### `POST /detect`
Main detection endpoint that accepts image files and returns detection results.

**Request:**
- Form data with `image` field containing the image file
- OR JSON with `image_data` field containing base64 encoded image

**Response:**
```json
{
  "success": true,
  "detections": [
    {
      "class": "with_mask",
      "confidence": 0.95,
      "bbox": {
        "x": 100,
        "y": 50,
        "width": 200,
        "height": 250
      }
    }
  ],
  "stats": {
    "with_mask": 1,
    "without_mask": 0,
    "mask_weared_incorrect": 0
  },
  "result_image": "data:image/jpeg;base64,/9j/4AAQ...",
  "total_detections": 1
}
```

### `POST /crop_faces`
Returns individual cropped faces from detected regions.

### `GET /health`
Health check endpoint to verify server and model status.

## Model Classes 

The system detects three classes:
1. **with_mask** (Class 0): Person wearing mask correctly 
2. **without_mask** (Class 1): Person not wearing mask 
3. **mask_weared_incorrect** (Class 2): Person wearing mask incorrectly 

## Usage Guide 

### Upload Mode
1. Click on the "Upload Images" tab
2. Drag and drop images or click to select files
3. View results with detection statistics and cropped faces

### Camera Mode
1. Click on the "Live Camera" tab
2. Click "Start Camera" to begin video feed
3. Click "Capture Photo" to take and process a snapshot
4. View results in the camera results section

### Monitoring Mode
1. Click on the "Auto Monitoring" tab
2. Select capture interval (30s to 5 minutes)
3. Enable/disable sound alerts
4. Click "Start Monitoring"
5. System will automatically capture and process images
6. View monitoring history and statistics

## Customization 

### Changing Detection Intervals
Edit the monitoring intervals in `index.html`:
```html
<select id="intervalSelect">
    <option value="30">30 seconds</option>
    <option value="60">1 minute</option>
    <option value="120" selected>2 minutes</option>
    <option value="300">5 minutes</option>
    <option value="600">10 minutes</option> <!-- Add custom intervals -->
</select>
```

### Modifying Alert Behavior
Adjust sound alerts and notification settings in `script_with_api.js`:
```javascript
// Disable alerts for specific classes
if (stats.withoutMask > 0 && document.getElementById('soundAlerts').checked) {
    playAlertSound();
    showAlert(`Warning: ${stats.withoutMask} person(s) without mask!`, 'warning');
}
```

### Styling Modifications
Customize the appearance by editing `styles.css`. The design uses:
- CSS Grid and Flexbox for responsive layouts
- CSS gradients and backdrop filters for modern effects
- Smooth animations and transitions
- Font Awesome icons

## Troubleshooting 

### Common Issues

1. **Camera not working:**
   - Ensure HTTPS is used for camera access (required by modern browsers)
   - Check browser permissions for camera access
   - Try different browsers (Chrome, Firefox, Safari)

2. **Model not loading:**
   - Verify `best_yolo_for_mask_detection.pt` exists in project root
   - Check file permissions
   - Review server logs for error messages

3. **API connection issues:**
   - Ensure Flask server is running on correct port
   - Check firewall settings
   - Verify API_BASE_URL in JavaScript matches server address

4. **Performance issues:**
   - Reduce image size before processing
   - Adjust monitoring intervals for better performance
   - Consider using GPU acceleration for YOLO inference

### Development Mode
For development, run Flask in debug mode:
```bash
export DEBUG=true
python app.py
```

## Production Deployment 

### Using Gunicorn
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Using Docker
Create a `Dockerfile`:
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

### Environment Variables
- `PORT`: Server port (default: 5000)
- `DEBUG`: Enable debug mode (default: False)

## Contributing 🤝

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments 🙏

- **YOLOv8** by Ultralytics for the detection model
- **Flask** for the web framework
- **Font Awesome** for the icons
- **OpenCV** for image processing

## Support 💬

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

Made with ❤️ for public health and safety
