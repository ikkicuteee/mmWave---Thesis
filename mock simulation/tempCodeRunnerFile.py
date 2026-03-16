import random
import math
import mysql.connector
import matplotlib
matplotlib.use("TkAgg")
import matplotlib.pyplot as plt
from matplotlib.widgets import Button
import pandas as pd
from datetime import datetime
from matplotlib.animation import FuncAnimation

# -------------------------------
# Configuration
# -------------------------------
UPDATE_INTERVAL = 10000  # milliseconds (10 seconds)
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
    host="127.0.0.1",
    user="root",
    password="root123",
    database="mmwave_sim"
)
cursor = conn.cursor()
cursor.execute("DROP TABLE IF EXISTS detections;")
cursor.execute("""
CREATE TABLE detections (
    obj_id INT,
    distance FLOAT,
    velocity FLOAT,
    angle FLOAT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
""")
conn.commit()

# -------------------------------
# Simulation State
# -------------------------------
simulation_on = True
history = {i: [] for i in range(1, MAX_OBJECTS + 1)}  # last positions for plotting

# -------------------------------
# Pre-fill history with fake positions for all colors
# -------------------------------
for obj_id in range(1, MAX_OBJECTS + 1):
    for _ in range(KEEP_LAST_N):
        dist = round(random.uniform(0.5, 1.5), 2)
        ang = round(random.uniform(-180, 180), 1)
        x = SENSOR_X + dist * math.sin(math.radians(ang))
        y = SENSOR_Y + dist * math.cos(math.radians(ang))
        history[obj_id].append((x, y))

# -------------------------------
# Functions
# -------------------------------
def insert_fake_data(object_id):
    distance = round(random.uniform(0.5, 1.5), 2)
    velocity = round(random.uniform(-0.5, 0.5), 2)
    angle = round(random.uniform(-180, 180), 1)
    cursor.execute(
        "INSERT INTO detections (obj_id, distance, velocity, angle) VALUES (%s, %s, %s, %s)",
        (object_id, distance, velocity, angle)
    )
    conn.commit()
    return distance, velocity, angle

def clean_old_data():
    for obj_id in range(1, MAX_OBJECTS + 1):
        cursor.execute(f"""
            DELETE FROM detections 
            WHERE obj_id = {obj_id} AND timestamp NOT IN (
                SELECT timestamp FROM (
                    SELECT timestamp FROM detections 
                    WHERE obj_id = {obj_id} 
                    ORDER BY timestamp DESC LIMIT {KEEP_LAST_N}
                ) tmp
            );
        """)
    conn.commit()

def get_latest_data():
    df = pd.read_sql("SELECT * FROM detections ORDER BY obj_id, timestamp ASC", conn)
    return df

def toggle_sim(event):
    global simulation_on
    simulation_on = not simulation_on
    btn_toggle.label.set_text("Stop Simulation" if simulation_on else "Start Simulation")
    print("Simulation resumed" if simulation_on else "Simulation paused")

def save_pdf(event):
    now = datetime.now().strftime("%H-%M-%S")
    filename = f"SAR_{now}.pdf"
    fig.savefig(filename)
    print(f"Radar image saved as {filename}.")

def update_plot(frame=None):
    global history
    # -------------------------------
    # Step 1: Insert new fake data if simulation is on
    # -------------------------------
    if simulation_on:
        for obj_id in range(1, MAX_OBJECTS + 1):
            dist, vel, ang = insert_fake_data(obj_id)
            x = SENSOR_X + dist * math.sin(math.radians(ang))
            y = SENSOR_Y + dist * math.cos(math.radians(ang))

            # Append new position
            history[obj_id].append((x, y))

            # Keep only last 3 positions
            if len(history[obj_id]) > KEEP_LAST_N:
                history[obj_id].pop(0)

        clean_old_data()

    # -------------------------------
    # Step 2: Clear and redraw
    # -------------------------------
    ax.clear()
    ax.set_xlim(0, ROOM_WIDTH)
    ax.set_ylim(0, ROOM_LENGTH)
    ax.set_xlabel("X (m)")
    ax.set_ylabel("Y (m)")
    ax.set_title(
        "Simulated mmWave Radar Detections\n"
        "Green = Recent\n"
        "Yellow = 61-120 seconds ago\n"
        "Red = 121-180 seconds ago"
    )
    ax.grid(True)

    # -------------------------------
    # Step 3: Draw each object's last positions
    # -------------------------------
    human_count = 0
    for obj_id, positions in history.items():
        n = len(positions)
        if n > 0:
            human_count += 1

        for idx, (x, y) in enumerate(positions):
            color = COLOR_MAP[idx]  # red, yellow, green
            ax.scatter(x, y, s=100, c=color)
            ax.text(x, y, str(obj_id), fontsize=12, fontweight='bold', ha='center', va='center')

    # -------------------------------
    # Step 4: Display current system time and human count
    # -------------------------------
    current_time = datetime.now().strftime("%H:%M:%S")
    ax.text(0.02, 1.02, f"Current Time: {current_time}", transform=ax.transAxes, fontsize=10)
    ax.text(0.7, 1.02, f"Human Detected: {human_count}", transform=ax.transAxes, fontsize=10)

# -------------------------------
# Setup Visualization
# -------------------------------
fig, ax = plt.subplots(figsize=(8, 8))
plt.subplots_adjust(bottom=0.25)

# Buttons
ax_toggle = plt.axes([0.1, 0.05, 0.25, 0.075])
btn_toggle = Button(ax_toggle, "Stop Simulation")
btn_toggle.on_clicked(toggle_sim)

ax_save = plt.axes([0.4, 0.05, 0.25, 0.075])
btn_save = Button(ax_save, "Save PDF")
btn_save.on_clicked(save_pdf)

# -------------------------------
# FuncAnimation for automatic updates
# -------------------------------
ani = FuncAnimation(fig, update_plot, interval=UPDATE_INTERVAL, cache_frame_data=False)
update_plot()  # Initial plot
plt.show()

# -------------------------------
# Close DB on exit
# -------------------------------
cursor.close()
conn.close()