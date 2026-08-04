import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyAVxZ_IxeeIEj2BAtLsxablrJibQEyhWtU',
  authDomain: 'boardgame-a06d1.firebaseapp.com',
  projectId: 'boardgame-a06d1',
  storageBucket: 'boardgame-a06d1.firebasestorage.app',
  messagingSenderId: '680569784282',
  appId: '1:680569784282:web:b21fb90cd657e2e899a2e3',
  measurementId: 'G-QT8FXW2FVG',
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let functions: Functions | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export function getFirebaseFunctions(): Functions {
  if (!functions) {
    functions = getFunctions(getFirebaseApp(), 'asia-northeast3');
  }
  return functions;
}

export { firebaseConfig };
