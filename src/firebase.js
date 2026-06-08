import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC31RYRzFeNYW2xBE0rnv_nj4Ifc-lKPNM",
  authDomain: "valush-bierpongtunier.firebaseapp.com",
  projectId: "valush-bierpongtunier",
  storageBucket: "valush-bierpongtunier.firebasestorage.app",
  messagingSenderId: "590626025268",
  appId: "1:590626025268:web:02e4d7e1dc97867bd67f61",
  measurementId: "G-997H6S96K1"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);