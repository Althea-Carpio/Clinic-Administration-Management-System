/* =====================================================================
   CAMS - database.js
   The ONLY file that touches localStorage.
   Works even when localStorage is blocked/unavailable (private mode,
   some file:// setups): it silently falls back to in-memory storage,
   so every page still runs - data just won't survive a reload.
   Load this file BEFORE any other script.
   ===================================================================== */
(function (global) {
  'use strict';

  var KEYS = {
    students: 'cams_students_v1',
    records:  'cams_records_v1',
    accounts: 'cams_accounts_v1',
    site:     'cams_site_v1',
    images:   'cams_images_v1',
    session:  'cams_session_v1'
  };
  var SEEDED_KEY = 'cams_seeded_v1';

  var DEFAULT_SITE = {
    ABOUT: 'The Clinic Administration Management System (CAMS) is a digital platform designed to help the school clinic efficiently manage student health records and daily clinic visits. It provides authorized clinic personnel with an organized and centralized way to record, update, and access essential student health information.',
    MISSION: 'The School Health and Nutrition Section is committed to provide effective health and nutrition service and to utilize these service as fertile Awareness for the inculcation of positive health values and behavior pursued with the spirit of dedication, high sense of mission and excellence towards the Development of a healthier and productive school populace in a clean healthy and Drug-free school and community environment.',
    VISION: 'The coming of the New Millennium will see dynamic innovation and service-oriented school health personnel that can help provide access to health and nutrition education activities, develop health habits and attitude among school populace that will make them capable of facing the challenge of the 21st century.',
    COMMITMENT: 'The School Health and Nutrition Section is committed to attain and maintain a healthy environment with the aim in view of having a physically and mentally fit citizenry.'
  };

  function defaultAccounts() {
    return [
      { id: 1, email: 'admin@cams.local', username: 'ADMIN', password: 'admin', status: 'active', role: 'admin' },
      { id: 2, email: 'nurse@cams.local', username: 'NURSE', password: 'nurse', status: 'active', role: 'nurse' }
    ];
  }

  /* ---------- storage layer with graceful fallback ---------- */
  var memory = {};
  var persistent = false;
  var store = null;
  try {
    store = global.localStorage;
    var probe = '__cams_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    persistent = true;
  } catch (e) {
    store = null;
    persistent = false;
  }

  function rawGet(key) {
    if (persistent) {
      try { return store.getItem(key); } catch (e) { persistent = false; }
    }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }
  function rawSet(key, str) {
    if (persistent) {
      try { store.setItem(key, str); return; } catch (e) { /* quota or blocked -> memory */ }
    }
    memory[key] = str;
  }
  function rawRemove(key) {
    if (persistent) { try { store.removeItem(key); } catch (e) {} }
    delete memory[key];
  }
  function read(key, fallback) {
    var s = rawGet(key);
    if (s === null || s === undefined) return fallback;
    try { return JSON.parse(s); } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { rawSet(key, JSON.stringify(value)); }
    catch (e) { if (global.console) console.warn('CAMS: could not save', key, e); }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- public API (never rename) ---------- */
  var DB = {
    persistent: persistent,

    getStudents: function () { var v = read(KEYS.students, []); return Array.isArray(v) ? v : []; },
    saveStudents: function (arr) { write(KEYS.students, arr || []); },

    getRecords: function () { var v = read(KEYS.records, []); return Array.isArray(v) ? v : []; },
    saveRecords: function (arr) { write(KEYS.records, arr || []); },

    getAccounts: function () {
      var v = read(KEYS.accounts, null);
      if (!Array.isArray(v) || !v.length) { v = defaultAccounts(); write(KEYS.accounts, v); }
      return v;
    },
    saveAccounts: function (arr) { write(KEYS.accounts, arr || []); },

    getSite: function () {
      var v = read(KEYS.site, null) || {};
      var out = clone(DEFAULT_SITE);
      for (var k in out) { if (typeof v[k] === 'string' && v[k].trim()) out[k] = v[k]; }
      return out;
    },
    saveSite: function (obj) { write(KEYS.site, obj || {}); },

    getImages: function () { var v = read(KEYS.images, {}); return v && typeof v === 'object' ? v : {}; },
    saveImages: function (obj) { write(KEYS.images, obj || {}); },

    getSession: function () { return read(KEYS.session, null); },
    setSession: function (obj) { write(KEYS.session, obj); },
    clearSession: function () { rawRemove(KEYS.session); },

    login: function (id, pw) {
      id = String(id || '').trim().toLowerCase();
      pw = String(pw || '');
      if (!id || !pw) return null;
      var list = DB.getAccounts();
      for (var i = 0; i < list.length; i++) {
        var a = list[i];
        if ((String(a.email).toLowerCase() === id || String(a.username).toLowerCase() === id) && a.password === pw) return a;
      }
      return null;
    },

    reset: function () {
      for (var k in KEYS) rawRemove(KEYS[k]);
      rawRemove(SEEDED_KEY);
    },

    /* extra helpers (additive - the contract above is untouched) */
    isSeeded: function () { return rawGet(SEEDED_KEY) === '1'; },
    markSeeded: function () { rawSet(SEEDED_KEY, '1'); }
  };

  /* Guard: only create the default accounts once so login works on first load */
  DB.getAccounts();

  /* requireLogin(): bounce to index.html when not signed in.
     If storage is not persistent a session can't travel between pages,
     so we let the page run instead of locking the user out. */
  function requireLogin(role) {
    if (!DB.persistent) return null;
    var s = DB.getSession();
    if (!s) { global.location.replace('index.html'); return null; }
    if (role && s.role !== role && s.role !== 'admin') { global.location.replace('index.html'); return null; }
    return s;
  }

  global.DB = DB;
  global.requireLogin = requireLogin;
})(window);
