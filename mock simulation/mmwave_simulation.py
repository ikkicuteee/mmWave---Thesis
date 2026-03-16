import random
import time
import math
import mysql.connector
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.widgets import Button
import pandas as pd
from sqlalchemy import create_engine

# -------------------------------
# Configuration
# -------------------------------
UPDATE_INTERVAL = 5  # seconds between updates
KEEP_LAST_N = 3
MAX_OBJECTS = 5
COLOR_MAP = {0: "red", 1: "yellow", 2: "green"}  # oldest to newest

ROOM_WIDTH = 3.0
ROOM_LENGTH = 3.0
SENSOR_X = ROOM_WIDTH / 2
SENSOR_Y = ROOM_LENGTH / 2

# -------------------------------
# MySQL Connection
# -------------------------------
conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="root123",
    database="mmwave_sim"
)
cursor = conn.cursor()
cursor.execute(
    "CREATE TABLE IF NOT EXISTS detections (id INT, distance FLOAT, velocity FLOAT, angle FLOAT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);"
)
cursor.execute("TRUNCATE TABLE detections;")

# -------------------------------
# Simulation State
# -------------------------------
simulation_on = True

# -------------------------------
# Functions
# -------------------------------
def insert_fake_data(object_id):
    distance = round(random.uniform(0.5, 1.5), 2)
    velocity = round(random.uniform(-0.5, 0.5), 2)
    angle = round(random.uniform(-180, 180), 1)
    cursor.execute(
        "INSERT INTO detections (id, distance, velocity, angle) VALUES (%s, %s, %s, %s)",
        (object_id, distance, velocity, angle)
    )
    conn.commit()
    return distance, velocity, angle

def clean_old_data():
    for obj_id in range(1, MAX_OBJECTS + 1):
        cursor.execute(f"""
            DELETE FROM detections 
            WHERE id = {obj_id} AND timestamp NOT IN (
                SELECT timestamp FROM (
                    SELECT timestamp FROM detections 
                    WHERE id = {obj_id} 
                    ORDER BY timestamp DESC LIMIT {KEEP_LAST_N}
                ) tmp
            );
        """)
    conn.commit()

def get_latest_data():
    df = pd.read_sql("SELECT * FROM detections ORDER BY id, timestamp ASC", engine)
    return df

def toggle_sim(event):
    """Button click handler to toggle simulation."""
    global simulation_on
    simulation_on = not simulation_on
    if simulation_on:
        button.label.set_text("Stop Simulation")
        print("Simulation resumed ✅")
    else:
        button.label.set_text("Start Simulation")
        print("Simulation paused ⏸️")

# -------------------------------
# Setup Visualization
# -------------------------------
plt.ion()
fig, ax = plt.subplots()
plt.subplots_adjust(bottom=0.2)  # leave space for button

# Button
ax_button = plt.axes([0.4, 0.05, 0.2, 0.075])  # x, y, width, height
button = Button(ax_button, 'Stop Simulation')
button.on_clicked(toggle_sim)

ax.set_xlim(0, ROOM_WIDTH)
ax.set_ylim(0, ROOM_LENGTH)
ax.set_xlabel("X (m)")
ax.set_ylabel("Y (m)")
ax.set_title("Simulated mmWave Radar Detections\n(Green=Newest, Red=Oldest)")

# -------------------------------
# SQLAlchemy engine for pandas
# -------------------------------
engine = create_engine("mysql+pymysql://root:root123@localhost/mmwave_sim")

# -------------------------------
# Main Loop
# -------------------------------
try:
    while True:
        if simulation_on:
            for obj_id in range(1, MAX_OBJECTS + 1):
                dist, vel, ang = insert_fake_data(obj_id)
                print(f"Object {obj_id}: Distance={dist}m, Velocity={vel}m/s, Angle={ang}°")
            clean_old_data()

        # Draw plot
        df = get_latest_data()
        ax.clear()
        ax.set_xlim(0, ROOM_WIDTH)
        ax.set_ylim(0, ROOM_LENGTH)
        ax.set_xlabel("X (m)")
        ax.set_ylabel("Y (m)")
        ax.set_title("Simulated mmWave Radar Detections\n(Green = Recent, Yellow = 5-10 seconds ago, Red = 11-15 seconds ago)")

        for obj_id in range(1, MAX_OBJECTS + 1):
            obj_data = df[df['id'] == obj_id].reset_index()
            n = len(obj_data)
            for i, row in obj_data.iterrows():
                angle_rad = math.radians(row['angle'])
                x = SENSOR_X + row['distance'] * math.sin(angle_rad)
                y = SENSOR_Y + row['distance'] * math.cos(angle_rad)
                color_idx = max(0, n - i - 1)
                color = COLOR_MAP[color_idx]
                ax.scatter(x, y, s=100, c=color)
                ax.text(x, y, str(row['id']))

        plt.pause(0.1)
        time.sleep(UPDATE_INTERVAL)

except KeyboardInterrupt:
    print("\nSimulation stopped.")
    cursor.close()
    conn.close()