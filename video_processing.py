import cv2
import sys
import os
from ultralytics import YOLO
import json

def analyze_video(video_path):
    try:
        model = YOLO('yolov8n.pt')

        video = cv2.VideoCapture(video_path)
        frame_count = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = video.get(cv2.CAP_PROP_FPS)

        print(f"Video Path: {video_path}")
        print(f"Frame Count: {frame_count}")
        print(f"FPS: {fps}")

        frame_number = 0
        all_results = []
        while video.isOpened():
            ret, frame = video.read()
            if ret:
                results = model(frame)
                all_results.append(results[0].boxes.data.tolist())
                annotated_frame = results[0].plot()
                if frame_number % int(fps) == 0:
                    frame_filename = f"frame_{int(frame_number / fps)}.jpg"
                    cv2.imwrite(os.path.join("frames", frame_filename), annotated_frame)
                frame_number += 1
            else:
                break

        video.release()
        cv2.destroyAllWindows()
        return json.dumps(all_results)
    except Exception as e:
        return f"An error occurred: {e}"

if __name__ == "__main__":
    # ... (rest of the main block remains the same)
    video_path = sys.argv[1]
    if not os.path.exists(video_path):
        print(f"Error: Video file not found at {video_path}")
        sys.exit(1)

    os.makedirs("frames", exist_ok=True)
    result = analyze_video(video_path)
    print(result)