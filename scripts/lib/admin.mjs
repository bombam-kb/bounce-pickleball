import { readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import admin from 'firebase-admin'
import { loadDotEnv, projectRoot } from './loadEnv.mjs'

loadDotEnv()

function env(name, fallback = '') {
  return (process.env[name] || fallback).trim()
}

function loadServiceAccount() {
  const raw = env('FIREBASE_SERVICE_ACCOUNT_JSON')
  if (raw) {
    try { return JSON.parse(raw) } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON')
    }
  }
  const rel = env('FIREBASE_SERVICE_ACCOUNT_PATH')
  if (!rel) {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT_PATH in .env (or FIREBASE_SERVICE_ACCOUNT_JSON)')
  }
  const file = isAbsolute(rel) ? rel : resolve(projectRoot(), rel)
  return JSON.parse(readFileSync(file, 'utf8'))
}

export function initAdmin() {
  if (admin.apps.length) return admin.app()
  const sa = loadServiceAccount()
  const projectId = env('VITE_FB_PROJECT_ID') || env('FB_PROJECT_ID') || sa.project_id
  return admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId,
  })
}

export function firestore() {
  initAdmin()
  return admin.firestore()
}
