#!/usr/bin/env python3
"""
Flask server for Face Mask Detection using YOLOv8
Handles image uploads and returns detection results
"""

import os
import io
import base64
import cv2
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from ultralytics import YOLO
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global variables
model = None
model_path = "best_yolo_for_mask_detection.pt"

def load_model():
    """Load the YOLOv8 model"""
    global model
    try:
        if os.path.exists(model_path):
            model = YOLO(model_path)
            logger.info(f"Model loaded successfully from {model_path}")
        else:
            logger.error(f"Model file not found: {model_path}")
            # Fallback to pretrained model
            model = YOLO('yolov8n.pt')
            logger.warning("Using pretrained YOLOv8n model as fallback")
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        model = None

def preprocess_image(image_data):
    """
    Preprocess image data for YOLO inference
    
    Args:
        image_data: Base64 encoded image or raw image bytes
        
    Returns:
        PIL Image object
    """
    try:
        # If it's a base64 string, decode it
        if isinstance(image_data, str):
            if image_data.startswith('data:image'):
                # Remove data URL prefix
                image_data = image_data.split(',')[1]
            image_bytes = base64.b64decode(image_data)
        else:
            image_bytes = image_data
            
        # Convert to PIL Image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
            
        return image
    except Exception as e:
        logger.error(f"Error preprocessing image: {str(e)}")
        return None

def postprocess_results(results, image_width, image_height):
    """
    Process YOLO results into a standard format
    
    Args:
        results: YOLO inference results
        image_width: Original image width
        image_height: Original image height
        
    Returns:
        List of detections with bounding boxes and class information
    """
    detections = []
    
    if results and len(results) > 0:
        result = results[0]  # Get first result
        
        if result.boxes is not None:
            boxes = result.boxes
            
            for i in range(len(boxes)):
                # Get bounding box coordinates (normalized)
                bbox = boxes.xyxy[i].cpu().numpy()  # x1, y1, x2, y2
                confidence = float(boxes.conf[i].cpu().numpy())
                class_id = int(boxes.cls[i].cpu().numpy())
                
                # Convert to absolute coordinates
                x1, y1, x2, y2 = bbox
                
                # Get class name
                class_name = model.names[class_id] if model and hasattr(model, 'names') else f"class_{class_id}"
                
                detection = {
                    "class": class_name,
                    "confidence": confidence,
                    "bbox": {
                        "x": int(x1),
                        "y": int(y1),
                        "width": int(x2 - x1),
                        "height": int(y2 - y1)
                    }
                }
                
                detections.append(detection)
    
    return detections

def draw_detections(image, detections):
    """
    Draw bounding boxes and labels on image
    
    Args:
        image: PIL Image object
        detections: List of detection results
        
    Returns:
        PIL Image with drawn detections
    """
    # Convert PIL to OpenCV format
    cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Define colors for each class
    colors = {
        'with_mask': (0, 255, 0),        # Green
        'without_mask': (0, 0, 255),     # Red  
        'mask_weared_incorrect': (0, 255, 255)  # Yellow
    }
    
    for detection in detections:
        bbox = detection['bbox']
        class_name = detection['class']
        confidence = detection['confidence']
        
        # Get color for this class
        color = colors.get(class_name, (255, 255, 255))
        
        # Draw bounding box
        x1 = bbox['x']
        y1 = bbox['y'] 
        x2 = x1 + bbox['width']
        y2 = y1 + bbox['height']
        
        cv2.rectangle(cv_image, (x1, y1), (x2, y2), color, 2)
        
        # Draw label
        label = f"{class_name.replace('_', ' ')} {confidence:.2f}"
        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
        
        # Draw label background
        cv2.rectangle(cv_image, (x1, y1 - label_size[1] - 10), 
                     (x1 + label_size[0], y1), color, -1)
        
        # Draw label text
        cv2.putText(cv_image, label, (x1, y1 - 5), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
    
    # Convert back to PIL Image
    result_image = Image.fromarray(cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB))
    return result_image

@app.route('/')
def index():
    """Serve the main HTML page"""
    return render_template('index.html')

@app.route('/detect', methods=['POST'])
def detect_masks():
    """
    Main detection endpoint
    Accepts image data and returns detection results
    """
    if model is None:
        return jsonify({
            'error': 'Model not loaded',
            'detections': []
        }), 500
    
    try:
        # Get image data from request
        if 'image' not in request.files and 'image_data' not in request.json:
            return jsonify({'error': 'No image provided'}), 400
        
        # Handle file upload
        if 'image' in request.files:
            file = request.files['image']
            if file.filename == '':
                return jsonify({'error': 'No file selected'}), 400
            image_data = file.read()
        else:
            # Handle base64 image data
            image_data = request.json.get('image_data')
        
        # Preprocess image
        image = preprocess_image(image_data)
        if image is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        # Run inference
        results = model(image)
        
        # Process results
        detections = postprocess_results(results, image.width, image.height)
        
        # Draw detections on image
        result_image = draw_detections(image, detections)
        
        # Convert result image to base64
        buffer = io.BytesIO()
        result_image.save(buffer, format='JPEG')
        result_image_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        # Calculate statistics
        stats = {
            'with_mask': sum(1 for d in detections if d['class'] == 'with_mask'),
            'without_mask': sum(1 for d in detections if d['class'] == 'without_mask'),
            'mask_weared_incorrect': sum(1 for d in detections if d['class'] == 'mask_weared_incorrect')
        }
        
        return jsonify({
            'success': True,
            'detections': detections,
            'stats': stats,
            'result_image': f"data:image/jpeg;base64,{result_image_base64}",
            'total_detections': len(detections)
        })
        
    except Exception as e:
        logger.error(f"Error during detection: {str(e)}")
        return jsonify({
            'error': f'Detection failed: {str(e)}',
            'detections': []
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'model_path': model_path
    })

@app.route('/model/reload', methods=['POST'])
def reload_model():
    """Reload the YOLO model"""
    try:
        load_model()
        return jsonify({
            'success': True,
            'message': 'Model reloaded successfully',
            'model_loaded': model is not None
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/crop_faces', methods=['POST'])
def crop_faces():
    """
    Crop detected faces from image
    Returns individual face crops with their classifications
    """
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    try:
        # Get image data
        if 'image' not in request.files and 'image_data' not in request.json:
            return jsonify({'error': 'No image provided'}), 400
        
        if 'image' in request.files:
            file = request.files['image']
            image_data = file.read()
        else:
            image_data = request.json.get('image_data')
        
        # Preprocess image
        image = preprocess_image(image_data)
        if image is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        # Run inference
        results = model(image)
        detections = postprocess_results(results, image.width, image.height)
        
        # Crop faces
        cropped_faces = []
        for i, detection in enumerate(detections):
            bbox = detection['bbox']
            
            # Add some padding to the crop
            padding = 20
            x1 = max(0, bbox['x'] - padding)
            y1 = max(0, bbox['y'] - padding)
            x2 = min(image.width, bbox['x'] + bbox['width'] + padding)
            y2 = min(image.height, bbox['y'] + bbox['height'] + padding)
            
            # Crop face
            face_crop = image.crop((x1, y1, x2, y2))
            
            # Convert to base64
            buffer = io.BytesIO()
            face_crop.save(buffer, format='JPEG')
            face_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            cropped_faces.append({
                'id': i,
                'class': detection['class'],
                'confidence': detection['confidence'],
                'image': f"data:image/jpeg;base64,{face_base64}",
                'bbox': bbox
            })
        
        return jsonify({
            'success': True,
            'faces': cropped_faces,
            'total_faces': len(cropped_faces)
        })
        
    except Exception as e:
        logger.error(f"Error cropping faces: {str(e)}")
        return jsonify({'error': f'Face cropping failed: {str(e)}'}), 500

@app.errorhandler(413)
def too_large(e):
    """Handle file too large error"""
    return jsonify({'error': 'File too large. Please upload a smaller image.'}), 413

@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(e):
    """Handle internal server errors"""
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Load model on startup
    logger.info("Starting Face Mask Detection Server...")
    load_model()
    
    if model is None:
        logger.error("Failed to load model. Server will start but detection will not work.")
    else:
        logger.info("Model loaded successfully!")
    
    # Configure Flask app
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    
    # Run the server
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Server starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)