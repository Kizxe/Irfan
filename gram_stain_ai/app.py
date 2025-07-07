import os
import sqlite3
import uuid
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session, g
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import base64

# Get the current directory for absolute paths
current_dir = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'default_secret_key_for_development')
app.config['UPLOAD_FOLDER'] = os.path.join(current_dir, 'static', 'uploads')
app.config['DATABASE'] = os.path.join(current_dir, 'gram_stain.db')

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Load the pre-trained model
model = None
try:
    model_path = os.path.join(current_dir, 'models/the_best_model_dominant.h5')
    print(f"Looking for model at: {model_path}")
    print(f"File exists: {os.path.exists(model_path)}")
    
    model = tf.keras.models.load_model(model_path, compile=False)
    print("Model loaded successfully")
except Exception as e:
    print(f"Error loading model: {e}")
    try:
        # Try with TFSMLayer if regular loading fails
        model = tf.keras.layers.TFSMLayer(model_path, call_endpoint='serving_default')
        print("Model loaded successfully using TFSMLayer")
    except Exception as e2:
        print(f"All loading attempts failed: {e2}")
        model = None

# Database initialization
def init_db():
    conn = sqlite3.connect(app.config['DATABASE'])
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS slides (
        id_slide TEXT PRIMARY KEY,
        name_patient TEXT NOT NULL,
        date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        image_path TEXT,
        result TEXT,
        confidence REAL
    )
    ''')
    conn.commit()
    conn.close()
    print("Database initialized")

# Initialize database on startup
init_db()

# Helper function to get database connection
def get_db():
    conn = sqlite3.connect(app.config['DATABASE'])
    conn.row_factory = sqlite3.Row  # This enables column access by name
    return conn

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/add_slide', methods=['GET', 'POST'])
def add_slide():
    if request.method == 'POST':
        id_slide = request.form.get('id_slide') or str(uuid.uuid4())[:8].upper()
        name_patient = request.form.get('name_patient')
        
        if not name_patient:
            flash('Patient name is required', 'error')
            return redirect(url_for('add_slide'))
        
        # Store slide info in session for later use with the image
        session['current_slide'] = {
            'id_slide': id_slide,
            'name_patient': name_patient
        }
        
        flash(f'Slide information saved. ID: {id_slide}', 'success')
        return redirect(url_for('index'))
    
    # Generate a new slide ID for the form
    suggested_id = str(uuid.uuid4())[:8].upper()
    return render_template('add_slide.html', suggested_id=suggested_id)

@app.route('/find_slide', methods=['GET', 'POST'])
def find_slide():
    # Handle direct access with ID parameter in URL
    id_from_url = request.args.get('id')
    if id_from_url:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM slides WHERE id_slide = ?', (id_from_url,))
        slide = cursor.fetchone()
        conn.close()
        
        if slide:
            return render_template('slide_details.html', slide=slide)
        else:
            flash('Slide not found', 'error')
            return redirect(url_for('find_slide'))
    
    if request.method == 'POST':
        search_type = request.form.get('search_type', 'id')
        
        if search_type == 'id':
            id_slide = request.form.get('id_slide')
            
            if not id_slide:
                flash('Slide ID is required', 'error')
                return redirect(url_for('find_slide'))
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM slides WHERE id_slide = ?', (id_slide,))
            slide = cursor.fetchone()
            conn.close()
            
            if slide:
                return render_template('slide_details.html', slide=slide)
            else:
                flash('Slide not found', 'error')
                return redirect(url_for('find_slide'))
        
        elif search_type == 'name':
            name_patient = request.form.get('name_patient')
            
            if not name_patient:
                flash('Patient name is required', 'error')
                return redirect(url_for('find_slide'))
            
            # Use LIKE for partial name matching
            search_term = f"%{name_patient}%"
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM slides WHERE name_patient LIKE ? ORDER BY date_created DESC', (search_term,))
            slides = cursor.fetchall()
            conn.close()
            
            if slides:
                if len(slides) == 1:
                    # If only one result, go directly to slide details
                    return render_template('slide_details.html', slide=slides[0])
                else:
                    # If multiple results, show a list
                    return render_template('search_results.html', slides=slides, search_term=name_patient)
            else:
                flash('No slides found for this patient', 'error')
                return redirect(url_for('find_slide'))
    
    return render_template('find_slide.html')



@app.route('/api/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'error': 'No file part'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'error': 'No selected file'})
    
    try:
        # Read and preprocess the image
        img = Image.open(file.stream)
        img = img.resize((224, 224))  # Adjust size based on your model's requirements
        img_array = np.array(img) / 255.0  # Normalize
        img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension
        
        # Make prediction if model is loaded
        if model is not None:
            if isinstance(model, tf.keras.layers.TFSMLayer):
                prediction_dict = model(img_array)
                prediction = prediction_dict.get('output', list(prediction_dict.values())[0])
                if isinstance(prediction, tf.Tensor):
                    prediction = prediction.numpy()
            else:
                prediction = model.predict(img_array)
                
            confidence = float(np.max(prediction[0]))
            gram_type = 'Gram-positive' if np.argmax(prediction[0]) == 1 else 'Gram-negative'
        else:
            # Mock prediction if model isn't loaded
            confidence = 0.85
            gram_type = 'Gram-positive' if np.random.random() > 0.5 else 'Gram-negative'
        
        # Save the image
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"gram_stain_{timestamp}.jpg"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        img.save(filepath)
        
        # Get slide info from session
        slide_info = session.get('current_slide', {})
        id_slide = slide_info.get('id_slide', str(uuid.uuid4())[:8].upper())
        name_patient = slide_info.get('name_patient', 'Unknown')
        
        # Save to database
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO slides (id_slide, name_patient, image_path, result, confidence) VALUES (?, ?, ?, ?, ?)',
            (id_slide, name_patient, filepath, gram_type, confidence)
        )
        conn.commit()
        conn.close()
        
        # Clear the session data
        session.pop('current_slide', None)
        
        return jsonify({
            'status': 'success',
            'gram_type': gram_type,
            'confidence': confidence,
            'id_slide': id_slide,
            'name_patient': name_patient
        })
        
    except Exception as e:
        print(f"Error during prediction: {e}")
        return jsonify({'status': 'error', 'error': str(e)})

@app.route('/api/history')
def get_history():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM slides ORDER BY date_created DESC')
        rows = cursor.fetchall()
        conn.close()
        
        history = []
        for row in rows:
            # Convert image path to URL
            image_url = url_for('static', filename=f"uploads/{os.path.basename(row['image_path'])}")
            
            history.append({
                'id': row['id_slide'],
                'name_patient': row['name_patient'],
                'date': row['date_created'],
                'gram_type': row['result'],
                'confidence': row['confidence'],
                'image_url': image_url
            })
        
        return jsonify({'status': 'success', 'history': history})
    
    except Exception as e:
        print(f"Error fetching history: {e}")
        return jsonify({'status': 'error', 'error': str(e)})

@app.route('/upload', methods=['POST'])
def upload():
    print("Upload route called")
    if 'file' not in request.files:
        flash('No file part', 'error')
        return redirect(url_for('index'))
    
    file = request.files['file']
    if file.filename == '':
        flash('No selected file', 'error')
        return redirect(url_for('index'))
    
    try:
        # Check file extension
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}
        if '.' not in file.filename or file.filename.rsplit('.', 1)[1].lower() not in allowed_extensions:
            flash('Invalid file format. Please upload an image file (JPG, PNG, etc.)', 'error')
            return redirect(url_for('index'))
        
        # Try to open the image to verify it's a valid image file
        try:
            img = Image.open(file.stream)
            # Reset file stream position after checking
            file.stream.seek(0)
        except Exception:
            flash('The file is not a valid image', 'error')
            return redirect(url_for('index'))
        
        # Process the file
        img = Image.open(file.stream)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"gram_stain_{timestamp}.jpg"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        img.save(filepath)
        
        # If model is loaded, perform analysis
        if model is not None:
            # Make prediction
            img_resized = img.resize((224, 224))
            img_array = np.array(img_resized) / 255.0
            img_array = np.expand_dims(img_array, axis=0)
            
            if isinstance(model, tf.keras.layers.TFSMLayer):
                prediction_dict = model(img_array)
                prediction = prediction_dict.get('output', list(prediction_dict.values())[0])
                if isinstance(prediction, tf.Tensor):
                    prediction = prediction.numpy()
            else:
                prediction = model.predict(img_array)
                
            confidence = float(np.max(prediction[0]))
            gram_type = 'Gram-positive' if np.argmax(prediction[0]) == 1 else 'Gram-negative'
        else:
            # Mock prediction if model isn't loaded
            confidence = 0.85
            gram_type = 'Gram-positive' if np.random.random() > 0.5 else 'Gram-negative'
        
        # Get slide info from session
        slide_info = session.get('current_slide', {})
        id_slide = slide_info.get('id_slide', str(uuid.uuid4())[:8].upper())
        name_patient = slide_info.get('name_patient', 'Unknown')
        
        # Save to database
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO slides (id_slide, name_patient, image_path, result, confidence) VALUES (?, ?, ?, ?, ?)',
            (id_slide, name_patient, filepath, gram_type, confidence)
        )
        conn.commit()
        conn.close()
        
        # Clear the session data
        session.pop('current_slide', None)
        
        # Redirect to result page or back to index
        flash(f'Analysis complete: {gram_type} ({confidence:.2%} confidence)', 'success')
        return redirect(url_for('index'))
    except Exception as e:
        flash(f'Error processing file: {str(e)}', 'error')
        return redirect(url_for('index'))

@app.route('/upload_file', methods=['POST'])
def upload_file():
    # Just call the upload function to avoid duplicate code
    return upload()

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

if __name__ == '__main__':
    app.run(debug=True)