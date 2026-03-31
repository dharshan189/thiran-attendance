import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-analytics.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";


const firebaseConfig = {
  apiKey: "AIzaSyDeJcMWUpi5hn4lriMAijZmHAWps1p70Bc",
  authDomain: "thiransmarthub-9c699.firebaseapp.com",
  projectId: "thiransmarthub-9c699",
  storageBucket: "thiransmarthub-9c699.firebasestorage.app",
  messagingSenderId: "150928833897",
  appId: "1:150928833897:web:fbfbc0e8128ada090a51f8",
  measurementId: "G-V0FH89RN6Z"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Exporting helpers for script.js
export { doc, setDoc, getDoc, collection, query, getDocs, deleteDoc, ref, uploadString, getDownloadURL };
