/* ==========================================================================
   Kayumi — Body Care Treatment, Wellness, and Creative Space
   script.js — Dynamic & Functional Edition (v2)

   Fitur utama:
   - Tab layanan dinamis, dark mode, salin nomor/link kontak
   - Kartu manfaat accessible, salin kontak
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  /* ------------------------------------------------------------------
     0. Helpers
     ------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (str) =>
    String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function retrigger(el, cls = 'swap-in') {
    if (!el || prefersReducedMotion) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // Toast (aman dari XSS + dukungan tombol aksi)
  const toastContainer = $('#toastContainer');
  function showToast(message, opts = {}) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    const icon = document.createElement('span');
    icon.textContent = opts.icon || '\u2713';
    const text = document.createElement('span');
    text.textContent = message;
    toast.append(icon, text);

    let timer;
    const remove = () => {
      clearTimeout(timer);
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    };

    if (opts.actionLabel && typeof opts.onAction === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action';
      btn.textContent = opts.actionLabel;
      btn.addEventListener('click', () => {
        opts.onAction();
        remove();
      });
      toast.append(btn);
    }

    toastContainer.appendChild(toast);
    timer = setTimeout(remove, opts.duration || 3400);
  }

  /* ------------------------------------------------------------------
     1. Navigasi: menu mobile, header sticky, scroll spy, back-to-top
     ------------------------------------------------------------------ */
  const header = $('#siteHeader');
  const menuToggle = $('#mobileMenuToggle');
  const navLinks = $('#navLinks');

  function setMenu(open) {
    if (!navLinks || !menuToggle) return;
    navLinks.classList.toggle('mobile-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
  }

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => setMenu(!navLinks.classList.contains('mobile-open')));
    navLinks.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) setMenu(false);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#navLinks') && !e.target.closest('#mobileMenuToggle')) setMenu(false);
    });
  }

  const spySections = $$('section[id]');
  const navItems = $$('.nav-links a[href^="#"]');
  const backToTop = $('#backToTop');
  let scrollTicking = false;

  function onScroll() {
    scrollTicking = false;
    if (header) header.classList.toggle('scrolled', window.scrollY > 20);
    if (backToTop) backToTop.classList.toggle('show', window.scrollY > 700);

    let current = '';
    spySections.forEach((sec) => {
      if (window.scrollY >= sec.offsetTop - 130) current = sec.id;
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = 'contact';
    if (current === 'benefits') current = 'services';

    if (navItems.some((a) => a.getAttribute('href') === '#' + current)) {
      navItems.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
    }
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  if (backToTop) {
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' }));
  }


  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------
     1b. Dark mode (ikut sistem, bisa diganti manual, tersimpan)
     ------------------------------------------------------------------ */
  const THEME_KEY = 'kayumi_theme';
  const themeToggle = $('#themeToggle');
  const themeMeta = $('meta[name="theme-color"]');
  const LOGO_LIGHT = 'LogoKayumiCoklat.png';
  const LOGO_DARK = 'logoKayumiPutih.png';
  const systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  const hasSavedTheme = () => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      return t === 'dark' || t === 'light';
    } catch (err) {
      return false;
    }
  };

  function applyTheme(theme) {
    const dark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.setAttribute('content', dark ? '#1B1612' : '#FBF6EE');
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(dark));
      themeToggle.setAttribute('aria-label', dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap');
      themeToggle.title = dark ? 'Mode terang' : 'Mode gelap';
    }
    // Logo cokelat tidak terbaca di latar gelap → pakai logo putih
    $$(`img[src="${LOGO_LIGHT}"], img[src="${LOGO_DARK}"][data-theme-logo]`).forEach((img) => {
      img.setAttribute('data-theme-logo', '');
      img.setAttribute('src', dark ? LOGO_DARK : LOGO_LIGHT);
    });
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  applyTheme(currentTheme());

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next); // string mentah, dibaca juga oleh skrip di <head>
      } catch (err) {
        /* abaikan */
      }
    });
  }

  // Kalau belum pernah memilih manual, ikuti pengaturan sistem secara langsung
  if (systemDark && systemDark.addEventListener) {
    systemDark.addEventListener('change', (e) => {
      if (!hasSavedTheme()) applyTheme(e.matches ? 'dark' : 'light');
    });
  }

  /* ------------------------------------------------------------------
     3. Layanan: tab dinamis
     ------------------------------------------------------------------ */
  const PHOTO = { swim1: 'swim1.jpg', swim2: 'swim2.jpg', yoga: 'yoga_photo.jpg' };

  const services = {
    'aqua-yoga': {
      title: 'Aqua Yoga',
      desc: 'Aqua Yoga adalah latihan tubuh yang dilakukan di dalam air dengan gerakan yoga yang lembut. Latihan ini menggabungkan manfaat yoga dan terapi air untuk membantu meningkatkan kekuatan otot, keseimbangan, fleksibilitas, serta memberikan relaksasi bagi tubuh dan pikiran.',
      image: PHOTO.swim2
    },
    'mindful-stretch': {
      title: 'Garden Stretching & Breathwork',
      desc: 'Sesi peregangan tubuh dan olah pernapasan di area taman terbuka yang asri. Membantu membuka ruang gerak sendi, menyegarkan paru-paru, serta mempererat kehangatan bersama komunitas Kayumi.',
      image: PHOTO.yoga
    },
    'hydro-wellness': {
      title: 'Private Group Hydro Wellness',
      desc: 'Program sesi kelompok privat di dalam kolam untuk komunitas, sahabat, atau keluarga yang ingin merasakan terapi gerak air secara eksklusif dengan pendampingan instruktur penuh.',
      image: PHOTO.swim1
    }
  };

  const serviceTabs = $$('.service-tab-btn');
  const serviceImageEl = $('#serviceMainImage');
  const serviceTitleEl = $('#serviceMainTitle');
  const serviceDescEl = $('#serviceMainDesc');
  const servicePhotoCard = $('.services-photo-card');

  function setService(key, { focusTab = false, silent = false } = {}) {
    const data = services[key];
    if (!data) return;

    serviceTabs.forEach((b) => {
      const on = b.dataset.service === key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
      b.setAttribute('tabindex', on ? '0' : '-1');
      if (on && focusTab) b.focus();
    });

    if (serviceTitleEl) serviceTitleEl.textContent = data.title;
    if (serviceDescEl) serviceDescEl.textContent = data.desc;
    if (serviceImageEl) {
      serviceImageEl.setAttribute('src', data.image);
      serviceImageEl.setAttribute('alt', 'Program ' + data.title + ' Kayumi');
    }
    if (!silent) [serviceTitleEl, serviceDescEl, servicePhotoCard].forEach((el) => retrigger(el));
  }

  serviceTabs.forEach((btn, i) => {
    btn.setAttribute('role', 'tab');
    btn.addEventListener('click', () => setService(btn.dataset.service));
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + serviceTabs.length) % serviceTabs.length;
      setService(serviceTabs[next].dataset.service, { focusTab: true });
    });
  });

  /* ------------------------------------------------------------------
     8. Kartu manfaat (accordion yang bisa diakses keyboard)
     ------------------------------------------------------------------ */
  $$('.benefit-card').forEach((card) => {
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-expanded', 'false');
    const toggle = () => {
      const on = card.classList.toggle('active');
      card.setAttribute('aria-expanded', String(on));
    };
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });

  /* ------------------------------------------------------------------
     10. Salin nomor / username kontak
     ------------------------------------------------------------------ */
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  $$('.js-copy-number').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.copy;
      if (!value) return;
      const label = btn.dataset.label || 'Teks';
      let ok = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(value);
          ok = true;
        }
      } catch (err) {
        ok = false;
      }
      if (!ok) ok = fallbackCopy(value);

      const original = btn.dataset.original || btn.textContent;
      btn.dataset.original = original;
      showToast(ok ? `${label} ${value} berhasil disalin!` : `Gagal menyalin. Salin manual: ${value}`, { icon: ok ? '\u2713' : '!' });
      if (ok) {
        btn.textContent = 'Tersalin \u2713';
        setTimeout(() => (btn.textContent = original), 1800);
      }
    });
  });

  /* ------------------------------------------------------------------
     11. Init
     ------------------------------------------------------------------ */
  setService('aqua-yoga', { silent: true });
});
