/**
 * Firebase: inicialização do app e conexão com Firestore.
 * Use as variáveis de ambiente em .env.local (veja .env.example).
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAnalytics, type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let analytics: Analytics | null = null;

function getApp(): FirebaseApp {
  if (!app) {
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      throw new Error(
        "Firebase: configure NEXT_PUBLIC_FIREBASE_* no .env.local (veja .env.example)"
      );
    }
    app = initializeApp(firebaseConfig);
  }
  return app;
}

/** Retorna a instância do Firestore (conexão com o banco). */
export function getDb(): Firestore {
  if (!db) {
    db = getFirestore(getApp());
  }
  return db;
}

/** Retorna o Analytics apenas no cliente (não disponível em SSR). */
export function getAnalyticsSafe(): Analytics | null {
  if (typeof window === "undefined") return null;
  if (!analytics) {
    analytics = getAnalytics(getApp());
  }
  return analytics;
}

export { getApp };
