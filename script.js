/* ==========================================================================
   Kayumi — Body Care Treatment, Wellness, and Creative Space
   script.js — Dynamic & Functional Edition (v2)

   Fitur utama:
   - Kuota sesi real-time (dihitung dari reservasi tersimpan, balik lagi kalau dihapus)
   - Tanggal sesi otomatis (kemunculan berikutnya tiap slot) + "Sesi terdekat"
   - Validasi form inline, tanggal minimal hari ini, min. peserta Private Group
   - Reservasi tersimpan di localStorage + Urungkan (undo) saat hapus
   - Carousel momen sungguhan: filter, dots dinamis, autoplay, swipe, lightbox
   - Modal: Esc, focus trap, scroll lock, aksesibilitas keyboard
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  /* ------------------------------------------------------------------
     0. Helpers
     ------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, '0');
  const rupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
  const esc = (str) =>
    String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const todayISO = () => toISO(new Date());
  const tomorrowISO = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toISO(d);
  };
  const fmtDate = (iso, opts) =>
    fromISO(iso).toLocaleDateString('id-ID', opts || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Safe storage (tetap jalan walau localStorage diblokir)
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        /* abaikan: quota penuh / sandbox */
      }
    }
  };

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
  const backToTop = $('#backToTop');

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
     2. Modal manager (Esc, focus trap, scroll lock)
     ------------------------------------------------------------------ */
  const bookingModal = $('#bookingModal');
  const serviceModal = $('#serviceModal');
  const myBookingsModal = $('#myBookingsModal');
  const lightboxModal = $('#lightboxModal');
  const focusStack = [];

  function openModal(modal) {
    if (!modal || modal.classList.contains('open')) return;
    focusStack.push(document.activeElement);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const first = $('.modal-close', modal);
    if (first) setTimeout(() => first.focus(), 60);
  }

  function closeModal(modal) {
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (!$('.modal-backdrop.open')) document.body.classList.remove('modal-open');
    const prev = focusStack.pop();
    if (prev && typeof prev.focus === 'function') prev.focus();
  }

  $$('.modal-backdrop').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
    const closeBtn = $('.modal-close', modal);
    if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modal));
  });

  document.addEventListener('keydown', (e) => {
    const openEls = $$('.modal-backdrop.open');
    if (!openEls.length) return;
    const top = openEls[openEls.length - 1];

    if (e.key === 'Escape') {
      closeModal(top);
      return;
    }
    if (top === lightboxModal) {
      if (e.key === 'ArrowLeft') stepLightbox(-1);
      if (e.key === 'ArrowRight') stepLightbox(1);
    }
    if (e.key === 'Tab') {
      const focusables = $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', top).filter(
        (el) => !el.hidden && el.offsetParent !== null
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* ------------------------------------------------------------------
     3. Katalog layanan & switcher dinamis
     ------------------------------------------------------------------ */
  const PHOTO = { swim1: 'swim1.jpg', swim2: 'swim2.jpg', yoga: 'yoga_photo.jpg' };

  const services = {
    'aqua-yoga': {
      title: 'Aqua Yoga',
      desc: 'Aqua Yoga adalah latihan tubuh yang dilakukan di dalam air dengan gerakan yoga yang lembut. Latihan ini menggabungkan manfaat yoga dan terapi air untuk membantu meningkatkan kekuatan otot, keseimbangan, fleksibilitas, serta memberikan relaksasi bagi tubuh dan pikiran.',
      duration: '60 Menit / Sesi',
      level: 'Pemula & Menengah',
      price: 'Rp 125.000 / Sesi',
      priceNum: 125000,
      minParticipants: 1,
      image: PHOTO.swim2,
      bullets: [
        '<strong>Durasi Sesi:</strong> 60 menit (Pemanasan Air, Inti Gerakan Yoga Air, Relaksasi Pernapasan).',
        '<strong>Tingkat Kesulitan:</strong> Ramah sendi, cocok untuk pemula maupun peserta berpengalaman.',
        '<strong>Manfaat Utama:</strong> Melatih otot inti, memperbaiki postur, mengurangi ketegangan sendi, dan meredakan stres.'
      ]
    },
    'mindful-stretch': {
      title: 'Garden Stretching & Breathwork',
      desc: 'Sesi peregangan tubuh dan olah pernapasan di area taman terbuka yang asri. Membantu membuka ruang gerak sendi, menyegarkan paru-paru, serta mempererat kehangatan bersama komunitas Kayumi.',
      duration: '75 Menit / Sesi',
      level: 'Semua Kalangan',
      price: 'Rp 110.000 / Sesi',
      priceNum: 110000,
      minParticipants: 1,
      image: PHOTO.yoga,
      bullets: [
        '<strong>Durasi Sesi:</strong> 75 menit di ruang hijau terbuka dengan matras yoga.',
        '<strong>Fokus Latihan:</strong> Kelenturan tulang belakang, keseimbangan tubuh, dan teknik napas dalam.',
        '<strong>Suasana:</strong> Hangat, suportif, dan diakhiri dengan sesi berbagi cerita bersama.'
      ]
    },
    'hydro-wellness': {
      title: 'Private Group Hydro Wellness',
      desc: 'Program sesi kelompok privat di dalam kolam untuk komunitas, sahabat, atau keluarga yang ingin merasakan terapi gerak air secara eksklusif dengan pendampingan instruktur penuh.',
      duration: '90 Menit / Sesi',
      level: 'Eksklusif Grup (Min. 4 Orang)',
      price: 'Rp 150.000 / Orang',
      priceNum: 150000,
      minParticipants: 4,
      image: PHOTO.swim1,
      bullets: [
        '<strong>Durasi Sesi:</strong> 90 menit dengan kurikulum gerakan yang disesuaikan kebutuhan grup.',
        '<strong>Pendampingan:</strong> Dipandu langsung oleh koordinator & instruktur berpengalaman Kayumi.',
        '<strong>Fasilitas:</strong> Konsultasi kebugaran ringan sebelum sesi dimulai.'
      ]
    }
  };

  const serviceTabs = $$('.service-tab-btn');
  const serviceImageEl = $('#serviceMainImage');
  const serviceTitleEl = $('#serviceMainTitle');
  const serviceDescEl = $('#serviceMainDesc');
  const serviceDurationEl = $('#serviceDurationPill');
  const serviceLevelEl = $('#serviceLevelPill');
  const servicePriceEl = $('#servicePricePill');
  const servicePillsWrap = $('.service-meta-pills');
  const servicePhotoCard = $('.services-photo-card');

  let activeServiceKey = 'aqua-yoga';
  let onlyActiveProgram = false; // filter jadwal: hanya program yang dipilih

  function setService(key, { focusTab = false, silent = false } = {}) {
    const data = services[key];
    if (!data) return;
    activeServiceKey = key;

    serviceTabs.forEach((b) => {
      const on = b.dataset.service === key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
      b.setAttribute('tabindex', on ? '0' : '-1');
      if (on && focusTab) b.focus();
    });

    if (serviceTitleEl) serviceTitleEl.textContent = data.title;
    if (serviceDescEl) serviceDescEl.textContent = data.desc;
    if (serviceDurationEl) serviceDurationEl.textContent = data.duration;
    if (serviceLevelEl) serviceLevelEl.textContent = data.level;
    if (servicePriceEl) servicePriceEl.textContent = data.price;
    if (serviceImageEl) {
      serviceImageEl.setAttribute('src', data.image);
      serviceImageEl.setAttribute('alt', 'Program ' + data.title + ' Kayumi');
    }

    if (!silent) [serviceTitleEl, serviceDescEl, servicePillsWrap, servicePhotoCard].forEach((el) => retrigger(el));

    if (onlyActiveProgram) renderSchedule();
    updateProgramToggleLabel();
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

  // Detail layanan (modal)
  const openServiceBtn = $('#learnMoreService');
  if (openServiceBtn) {
    openServiceBtn.addEventListener('click', () => {
      const data = services[activeServiceKey];
      const mTitle = $('#serviceModalTitle');
      const mDesc = $('#serviceModalDesc');
      const mList = $('#serviceModalList');
      if (mTitle) mTitle.textContent = 'Program ' + data.title;
      if (mDesc) mDesc.textContent = data.desc;
      if (mList) mList.innerHTML = data.bullets.map((b) => `<li>${b}</li>`).join('');
      openModal(serviceModal);
    });
  }

  const bookFromServiceBtn = $('#bookFromServiceBtn');
  if (bookFromServiceBtn) {
    bookFromServiceBtn.addEventListener('click', () => {
      closeModal(serviceModal);
      openBooking({ serviceKey: activeServiceKey });
    });
  }

  /* ------------------------------------------------------------------
     4. Reservasi (state) — sumber kebenaran kuota
     ------------------------------------------------------------------ */
  const STORAGE_KEY = 'kayumi_bookings_v2';
  let bookings = store.get(STORAGE_KEY, []);
  if (!Array.isArray(bookings)) bookings = [];

  function persistBookings() {
    store.set(STORAGE_KEY, bookings);
  }

  /* ------------------------------------------------------------------
     5. Jadwal mingguan dinamis (kuota, tanggal berikutnya, filter)
     ------------------------------------------------------------------ */
  const DAY_INDEX = { minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6 };

  const slots = [
    { id: 'slot-1', day: 'rabu', dayLabel: 'Rabu Pagi', start: '08:00', end: '09:00', serviceKey: 'aqua-yoga', mentor: 'Cicilia Dwi Susanti', quota: 6 },
    { id: 'slot-2', day: 'jumat', dayLabel: 'Jumat Pagi', start: '08:00', end: '09:15', serviceKey: 'mindful-stretch', mentor: 'Ritta Zahara', quota: 8 },
    { id: 'slot-3', day: 'sabtu', dayLabel: 'Sabtu Pagi', start: '07:30', end: '08:30', serviceKey: 'aqua-yoga', mentor: 'Cicilia Dwi Susanti', quota: 5 },
    { id: 'slot-4', day: 'sabtu', dayLabel: 'Sabtu Siang', start: '09:30', end: '11:00', serviceKey: 'hydro-wellness', mentor: 'Ritta Zahara', quota: 4 },
    { id: 'slot-5', day: 'minggu', dayLabel: 'Minggu Pagi', start: '07:30', end: '08:30', serviceKey: 'aqua-yoga', mentor: 'Cicilia Dwi Susanti', quota: 7 },
    { id: 'slot-6', day: 'minggu', dayLabel: 'Minggu Pagi', start: '09:00', end: '10:15', serviceKey: 'mindful-stretch', mentor: 'Ritta Zahara', quota: 9 }
  ];

  const slotById = (id) => slots.find((s) => s.id === id);
  const slotTime = (s) => `${s.start.replace(':', '.')} – ${s.end.replace(':', '.')} WIB`;
  const slotStartDate = (s, iso) => {
    const [h, m] = s.start.split(':').map(Number);
    const d = fromISO(iso);
    d.setHours(h, m, 0, 0);
    return d;
  };

  // Tanggal kemunculan berikutnya dari slot (hari ini kalau jamnya belum lewat)
  function nextOccurrence(slot, now = new Date()) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + ((DAY_INDEX[slot.day] - d.getDay() + 7) % 7));
    if (slotStartDate(slot, toISO(d)) <= now) d.setDate(d.getDate() + 7);
    return toISO(d);
  }

  const bookedFor = (slotId, iso) =>
    bookings.filter((b) => b.slotId === slotId && b.date === iso).reduce((sum, b) => sum + b.participants, 0);

  const remainingFor = (slotId, iso) => {
    const slot = slotById(slotId);
    return slot ? Math.max(0, slot.quota - bookedFor(slotId, iso)) : 0;
  };

  const scheduleBox = $('.schedule-box');
  const scheduleGrid = $('#scheduleSlotsGrid');
  const dayFilterBtns = $$('.day-filter-btn');
  const programToggle = $('#programOnlyToggle');
  const nextSessionEl = $('#nextSessionInfo');
  let activeDay = 'all';

  function updateProgramToggleLabel() {
    if (!programToggle) return;
    programToggle.textContent = onlyActiveProgram
      ? `Hanya: ${services[activeServiceKey].title}`
      : 'Hanya program terpilih';
    programToggle.setAttribute('aria-pressed', String(onlyActiveProgram));
  }

  function renderSchedule() {
    if (!scheduleGrid) return;
    const now = new Date();
    const today = toISO(now);

    const list = slots.filter(
      (s) => (activeDay === 'all' || s.day === activeDay) && (!onlyActiveProgram || s.serviceKey === activeServiceKey)
    );

    if (!list.length) {
      scheduleGrid.innerHTML = `<p class="empty-state">Belum ada sesi untuk filter ini. Coba pilih hari lain atau matikan filter program.</p>`;
      return;
    }

    scheduleGrid.innerHTML = list
      .map((slot) => {
        const iso = nextOccurrence(slot, now);
        const left = remainingFor(slot.id, iso);
        const full = left === 0;
        const low = left > 0 && left <= 2;
        const quotaClass = full ? 'full' : low ? 'low' : '';
        const quotaText = full ? 'Penuh' : `Sisa ${left} Kuota`;
        const isToday = iso === today;
        return `
      <div class="slot-card${full ? ' is-full' : ''}">
        <div>
          <div class="slot-top">
            <span class="slot-day">${esc(slot.dayLabel)} &bull; ${esc(slotTime(slot))}</span>
            <span class="slot-quota ${quotaClass}">${quotaText}</span>
          </div>
          <h4 class="slot-title">${esc(services[slot.serviceKey].title)}</h4>
          <p class="slot-meta">Koordinator: ${esc(slot.mentor)}</p>
          <p class="slot-date">${isToday ? '<span class="slot-today">Hari ini</span>' : ''}${esc(
          fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })
        )}</p>
        </div>
        <button type="button" class="btn btn-outline btn-sm js-book-slot" data-slot="${slot.id}"${full ? ' disabled' : ''}>
          <span>${full ? 'Kuota Penuh' : 'Pilih Jadwal Ini'}</span>
          ${full ? '' : '<span aria-hidden="true">&rarr;</span>'}
        </button>
      </div>`;
      })
      .join('');
  }

  function updateNextSession() {
    if (!nextSessionEl) return;
    const now = new Date();
    const upcoming = slots
      .map((s) => {
        const iso = nextOccurrence(s, now);
        return { s, iso, left: remainingFor(s.id, iso), at: slotStartDate(s, iso) };
      })
      .filter((x) => x.left > 0)
      .sort((a, b) => a.at - b.at)[0];

    if (!upcoming) {
      nextSessionEl.textContent = 'Semua sesi minggu ini sudah penuh. Hubungi koordinator untuk jadwal tambahan.';
      return;
    }
    const label = `${fmtDate(upcoming.iso, { weekday: 'long', day: 'numeric', month: 'short' })}, ${upcoming.s.start.replace(
      ':',
      '.'
    )} WIB · ${services[upcoming.s.serviceKey].title}`;
    nextSessionEl.innerHTML = `<span>Sesi terdekat:</span> <strong>${esc(label)}</strong>
      <button type="button" class="btn btn-primary btn-sm js-book-slot" data-slot="${upcoming.s.id}">Pesan</button>`;
  }

  dayFilterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeDay = btn.dataset.day;
      dayFilterBtns.forEach((b) => b.classList.toggle('active', b === btn));
      renderSchedule();
    });
  });

  if (programToggle) {
    programToggle.addEventListener('click', () => {
      onlyActiveProgram = !onlyActiveProgram;
      updateProgramToggleLabel();
      renderSchedule();
    });
  }

  if (scheduleBox) {
    scheduleBox.addEventListener('click', (e) => {
      const btn = e.target.closest('.js-book-slot');
      if (btn && !btn.disabled) openBooking({ slotId: btn.dataset.slot });
    });
  }

  /* ------------------------------------------------------------------
     6. Form reservasi: validasi, estimasi biaya, simpan & kirim WA
     ------------------------------------------------------------------ */
  const bookingForm = $('#bookingForm');
  const nameInput = $('#visitorName');
  const programSelect = $('#bookingProgram');
  const countInput = $('#participantCount');
  const dateInput = $('#sessionDate');
  const adminSelect = $('#adminContact');
  const notesInput = $('#visitorNotes');
  const totalText = $('#bookingTotalEstimate');
  const slotBanner = $('#slotBanner');
  const slotBannerText = $('#slotBannerText');
  const clearSlotBtn = $('#clearSlotBtn');

  let selectedSlot = null; // { id, date }

  function setError(input, errId, message) {
    const err = $('#' + errId);
    if (err) err.textContent = message;
    if (input) {
      input.classList.add('invalid');
      input.setAttribute('aria-invalid', 'true');
    }
  }

  function clearErrors() {
    $$('.field-error', bookingForm).forEach((el) => (el.textContent = ''));
    $$('.form-control.invalid', bookingForm).forEach((el) => {
      el.classList.remove('invalid');
      el.removeAttribute('aria-invalid');
    });
  }

  function updateTotal() {
    if (!totalText || !programSelect || !countInput) return;
    const svc = services[programSelect.value] || services['aqua-yoga'];
    const count = Math.max(1, parseInt(countInput.value || '1', 10) || 1);
    totalText.textContent = rupiah(svc.priceNum * count);
    totalText.title = `${count} × ${rupiah(svc.priceNum)}`;
  }

  function updateSlotBanner() {
    if (!slotBanner) return;
    if (!selectedSlot) {
      slotBanner.hidden = true;
      if (countInput) countInput.removeAttribute('max');
      return;
    }
    const slot = slotById(selectedSlot.id);
    const left = remainingFor(selectedSlot.id, selectedSlot.date);
    slotBanner.hidden = false;
    slotBannerText.textContent = `${slot.dayLabel}, ${fmtDate(selectedSlot.date, { day: 'numeric', month: 'long' })} · ${slotTime(
      slot
    )} · Sisa kuota ${left}`;
    if (countInput) countInput.max = String(Math.max(1, left));
  }

  function selectSlot(id) {
    const slot = slotById(id);
    if (!slot) return;
    selectedSlot = { id, date: nextOccurrence(slot) };
    programSelect.value = slot.serviceKey;
    dateInput.value = selectedSlot.date;
    const opt = $$('option', adminSelect).find((o) => o.dataset.name === slot.mentor);
    if (opt) adminSelect.value = opt.value;
    notesInput.value = `Jadwal: ${slot.dayLabel} (${slotTime(slot)})`;
    const svc = services[slot.serviceKey];
    if ((parseInt(countInput.value, 10) || 1) < svc.minParticipants) countInput.value = svc.minParticipants;
    updateSlotBanner();
    updateTotal();
  }

  function clearSlot() {
    selectedSlot = null;
    updateSlotBanner();
  }

  function openBooking({ serviceKey, slotId } = {}) {
    clearErrors();
    if (dateInput) {
      dateInput.min = todayISO();
      if (!dateInput.value || dateInput.value < todayISO()) dateInput.value = tomorrowISO();
    }
    if (serviceKey && services[serviceKey] && programSelect) programSelect.value = serviceKey;
    clearSlot();
    if (slotId) selectSlot(slotId);
    enforceMinParticipants();
    updateTotal();
    openModal(bookingModal);
  }

  function enforceMinParticipants() {
    const svc = services[programSelect.value];
    if (svc && (parseInt(countInput.value, 10) || 1) < svc.minParticipants) countInput.value = svc.minParticipants;
  }

  $$('.js-open-booking').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openBooking({ serviceKey: activeServiceKey });
    });
  });

  if (programSelect) {
    programSelect.addEventListener('change', () => {
      if (selectedSlot && slotById(selectedSlot.id).serviceKey !== programSelect.value) clearSlot();
      enforceMinParticipants();
      updateTotal();
    });
  }
  if (countInput) {
    countInput.addEventListener('input', () => {
      updateTotal();
      $('#errCount').textContent = '';
      countInput.classList.remove('invalid');
    });
  }
  if (dateInput) {
    dateInput.addEventListener('change', () => {
      if (selectedSlot && dateInput.value !== selectedSlot.date) clearSlot();
      $('#errDate').textContent = '';
      dateInput.classList.remove('invalid');
    });
  }
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      $('#errName').textContent = '';
      nameInput.classList.remove('invalid');
    });
  }
  if (clearSlotBtn) clearSlotBtn.addEventListener('click', clearSlot);

  function validateForm() {
    clearErrors();
    let ok = true;

    if (nameInput.value.trim().length < 2) {
      setError(nameInput, 'errName', 'Masukkan nama lengkap (minimal 2 karakter).');
      ok = false;
    }

    const count = parseInt(countInput.value, 10);
    const svc = services[programSelect.value];
    if (!Number.isInteger(count) || count < 1) {
      setError(countInput, 'errCount', 'Jumlah peserta minimal 1 orang.');
      ok = false;
    } else if (count > 25) {
      setError(countInput, 'errCount', 'Maksimal 25 peserta per reservasi.');
      ok = false;
    } else if (count < svc.minParticipants) {
      setError(countInput, 'errCount', `Program ini minimal ${svc.minParticipants} peserta.`);
      ok = false;
    } else if (selectedSlot) {
      const left = remainingFor(selectedSlot.id, selectedSlot.date);
      if (count > left) {
        setError(countInput, 'errCount', left ? `Sisa kuota sesi ini hanya ${left} orang.` : 'Kuota sesi ini sudah penuh.');
        ok = false;
      }
    }

    if (!dateInput.value || dateInput.value < todayISO()) {
      setError(dateInput, 'errDate', 'Pilih tanggal hari ini atau setelahnya.');
      ok = false;
    }

    if (!ok) {
      const firstBad = $('.form-control.invalid', bookingForm);
      if (firstBad) firstBad.focus();
    }
    return ok;
  }

  function buildWaUrl(b) {
    const text =
      `Halo Ibu ${b.adminName} (Kayumi), saya *${b.name}* ingin reservasi sesi *${b.programTitle}* ` +
      `untuk *${b.participants} orang* pada *${fmtDate(b.date)}* (Estimasi: ${rupiah(b.total)}).` +
      (b.notes ? ` Catatan: ${b.notes}` : '');
    return `https://wa.me/${b.adminPhone}?text=${encodeURIComponent(text)}`;
  }

  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateForm()) return;

      const key = programSelect.value;
      const svc = services[key];
      const participants = parseInt(countInput.value, 10);
      const adminOpt = adminSelect.options[adminSelect.selectedIndex];

      const booking = {
        id: 'bk-' + Date.now(),
        name: nameInput.value.trim(),
        serviceKey: key,
        programTitle: svc.title,
        participants,
        date: dateInput.value,
        adminName: adminOpt.dataset.name || 'Koordinator Kayumi',
        adminPhone: adminSelect.value,
        notes: notesInput.value.trim(),
        total: svc.priceNum * participants,
        slotId: selectedSlot ? selectedSlot.id : null,
        createdAt: Date.now()
      };

      bookings.unshift(booking);
      persistBookings();

      closeModal(bookingModal);
      bookingForm.reset();
      clearSlot();
      refreshAll();

      const win = window.open(buildWaUrl(booking), '_blank', 'noopener,noreferrer');
      showToast(
        win
          ? 'Reservasi tersimpan! Membuka WhatsApp koordinator…'
          : 'Reservasi tersimpan. Buka "Jadwal Saya" lalu klik Chat WA untuk mengirim.',
        { duration: 4200 }
      );
    });
  }

  /* ------------------------------------------------------------------
     7. Jadwal Saya (riwayat reservasi)
     ------------------------------------------------------------------ */
  const savedList = $('#savedBookingsList');

  function updateBookingBadges() {
    $$('.js-booking-count').forEach((el) => (el.textContent = String(bookings.length)));
  }

  function renderSavedBookings() {
    if (!savedList) return;
    if (!bookings.length) {
      savedList.innerHTML = `<p class="empty-state">Belum ada reservasi. Klik <strong>Book a Session</strong> untuk membuat jadwal baru.</p>`;
      return;
    }

    const today = todayISO();
    const upcoming = bookings.filter((b) => b.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const past = bookings.filter((b) => b.date < today).sort((a, b) => b.date.localeCompare(a.date));
    const totalUpcoming = upcoming.reduce((sum, b) => sum + b.total, 0);

    const card = (b, isPast) => `
      <div class="booking-item-card${isPast ? ' is-past' : ''}">
        <div class="booking-item-info">
          <h4>${esc(b.programTitle)} (${b.participants} Peserta)
            <span class="status-chip ${isPast ? 'past' : 'upcoming'}">${isPast ? 'Selesai' : 'Mendatang'}</span>
          </h4>
          <p>Atas Nama: <strong>${esc(b.name)}</strong> &bull; ${esc(fmtDate(b.date))}</p>
          <p>Koordinator: ${esc(b.adminName)} &bull; Estimasi: <strong>${rupiah(b.total)}</strong></p>
          ${b.notes ? `<p>Catatan: ${esc(b.notes)}</p>` : ''}
        </div>
        <div class="booking-item-actions">
          <a href="${esc(buildWaUrl(b))}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Chat WA</a>
          <button type="button" class="btn btn-sm btn-danger-outline js-delete-booking" data-id="${esc(b.id)}">Hapus</button>
        </div>
      </div>`;

    savedList.innerHTML = `
      <div class="booking-summary-row">
        <span>${upcoming.length} sesi mendatang &bull; Estimasi total <strong>${rupiah(totalUpcoming)}</strong></span>
        <button type="button" class="btn btn-sm btn-danger-outline js-clear-bookings">Hapus Semua</button>
      </div>
      ${upcoming.map((b) => card(b, false)).join('')}
      ${past.map((b) => card(b, true)).join('')}`;
  }

  if (savedList) {
    savedList.addEventListener('click', (e) => {
      const del = e.target.closest('.js-delete-booking');
      if (del) {
        const idx = bookings.findIndex((b) => b.id === del.dataset.id);
        if (idx < 0) return;
        const [removed] = bookings.splice(idx, 1);
        persistBookings();
        refreshAll();
        renderSavedBookings();
        showToast('Reservasi dihapus.', {
          actionLabel: 'Urungkan',
          duration: 5000,
          onAction: () => {
            bookings.splice(Math.min(idx, bookings.length), 0, removed);
            persistBookings();
            refreshAll();
            renderSavedBookings();
          }
        });
        return;
      }
      if (e.target.closest('.js-clear-bookings')) {
        const backup = bookings.slice();
        bookings = [];
        persistBookings();
        refreshAll();
        renderSavedBookings();
        showToast('Semua reservasi dihapus.', {
          actionLabel: 'Urungkan',
          duration: 5000,
          onAction: () => {
            bookings = backup;
            persistBookings();
            refreshAll();
            renderSavedBookings();
          }
        });
      }
    });
  }

  $$('.js-open-my-bookings').forEach((btn) => {
    btn.addEventListener('click', () => {
      renderSavedBookings();
      openModal(myBookingsModal);
    });
  });

  function refreshAll() {
    updateBookingBadges();
    renderSchedule();
    updateNextSession();
    updateSlotBanner();
  }

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
     9. Our Moments: carousel dinamis + filter + lightbox
     ------------------------------------------------------------------ */
  const moments = [
    {
      id: 'm1',
      title: 'Sesi Pagi Aqua Yoga',
      category: 'pool',
      tag: 'Terapi Air & Keseimbangan',
      desc: 'Latihan pernapasan dan rentangan tangan lembut di dalam air kolam yang jernih bersama komunitas Kayumi.',
      img: PHOTO.swim1
    },
    {
      id: 'm2',
      title: 'Gerakan Harmoni Bersama',
      category: 'pool',
      tag: 'Kekuatan Otot & Koordinasi',
      desc: 'Latihan berbaris saling terhubung di dalam kolam untuk melatih keseimbangan tubuh, fokus, dan kekompakan.',
      img: PHOTO.swim2
    },
    {
      id: 'm3',
      title: 'Kebersamaan Komunitas Kayumi',
      category: 'community',
      tag: 'Garden Stretching & Koneksi',
      desc: 'Momen peregangan santai dan keceriaan bersama para peserta di atas matras taman setelah sesi selesai.',
      img: PHOTO.yoga
    }
  ];

  const momentsGrid = $('#momentsGrid');
  const momentsViewport = $('.moments-track-Viewport');
  const momentsWrap = $('.moments-carousel-wrap');
  const dotsWrap = $('#carouselDots');
  const prevBtn = $('#momentsPrev');
  const nextBtn = $('#momentsNext');
  const momentFilterBtns = $$('.moment-filter-btn');

  let momentFilter = 'all';
  let momentIndex = 0;
  let autoTimer = null;
  let hoverPaused = false;

  const momentList = () => (momentFilter === 'all' ? moments : moments.filter((m) => m.category === momentFilter));

  function renderMoments(dir = 0) {
    if (!momentsGrid) return;
    const list = momentList();
    const n = list.length;
    momentIndex = ((momentIndex % n) + n) % n;
    const view = Math.min(3, n);

    momentsGrid.dataset.count = String(view);
    momentsGrid.innerHTML = Array.from({ length: view }, (_, i) => list[(momentIndex + i) % n])
      .map(
        (m) => `
      <div class="moment-card" role="button" tabindex="0" data-id="${m.id}" aria-label="Perbesar foto: ${esc(m.title)}">
        <img src="${esc(m.img)}" alt="${esc(m.title)}" loading="lazy">
        <div class="moment-caption-overlay">
          <span>${esc(m.title)}</span>
          <small>${esc(m.tag)}</small>
        </div>
      </div>`
      )
      .join('');

    if (dir) {
      momentsGrid.classList.remove('slide-next', 'slide-prev');
      void momentsGrid.offsetWidth;
      if (!prefersReducedMotion) momentsGrid.classList.add(dir > 0 ? 'slide-next' : 'slide-prev');
    }

    if (dotsWrap) {
      dotsWrap.innerHTML = list
        .map(
          (m, i) =>
            `<button type="button" class="carousel-dot${i === momentIndex ? ' active' : ''}" data-index="${i}" aria-label="Slide ${i + 1}: ${esc(
              m.title
            )}"></button>`
        )
        .join('');
      dotsWrap.classList.toggle('is-hidden', n < 2);
    }
    [prevBtn, nextBtn].forEach((b) => b && b.classList.toggle('is-hidden', n < 2));
  }

  function goMoment(delta, { manual = false } = {}) {
    momentIndex += delta;
    renderMoments(delta);
    if (manual) restartAuto();
  }

  function stopAuto() {
    clearInterval(autoTimer);
    autoTimer = null;
  }

  function startAuto() {
    stopAuto();
    if (prefersReducedMotion || momentList().length < 2) return;
    autoTimer = setInterval(() => {
      if (hoverPaused || document.hidden || $('.modal-backdrop.open')) return;
      goMoment(1);
    }, 5500);
  }
  const restartAuto = () => startAuto();

  if (prevBtn) prevBtn.addEventListener('click', () => goMoment(-1, { manual: true }));
  if (nextBtn) nextBtn.addEventListener('click', () => goMoment(1, { manual: true }));

  if (dotsWrap) {
    dotsWrap.addEventListener('click', (e) => {
      const dot = e.target.closest('.carousel-dot');
      if (!dot) return;
      const target = parseInt(dot.dataset.index, 10);
      const dir = target >= momentIndex ? 1 : -1;
      momentIndex = target;
      renderMoments(dir);
      restartAuto();
    });
  }

  momentFilterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      momentFilter = btn.dataset.filter;
      momentFilterBtns.forEach((b) => b.classList.toggle('active', b === btn));
      momentIndex = 0;
      renderMoments(1);
      restartAuto();
    });
  });

  if (momentsWrap) {
    momentsWrap.addEventListener('mouseenter', () => (hoverPaused = true));
    momentsWrap.addEventListener('mouseleave', () => (hoverPaused = false));
    momentsWrap.addEventListener('focusin', () => (hoverPaused = true));
    momentsWrap.addEventListener('focusout', () => (hoverPaused = false));
  }

  // Swipe di layar sentuh
  if (momentsViewport) {
    let touchX = null;
    momentsViewport.addEventListener(
      'touchstart',
      (e) => {
        touchX = e.changedTouches[0].clientX;
      },
      { passive: true }
    );
    momentsViewport.addEventListener(
      'touchend',
      (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) > 45 && momentList().length > 1) goMoment(dx < 0 ? 1 : -1, { manual: true });
      },
      { passive: true }
    );
  }

  // Lightbox
  const lightboxImg = $('#lightboxImage');
  const lightboxTitle = $('#lightboxTitle');
  const lightboxDesc = $('#lightboxDesc');
  const lightboxCount = $('#lightboxCount');
  const lightboxPrev = $('#lightboxPrev');
  const lightboxNext = $('#lightboxNext');
  let lbList = [];
  let lbIndex = 0;

  function fillLightbox() {
    const m = lbList[lbIndex];
    if (!m) return;
    lightboxImg.setAttribute('src', m.img);
    lightboxImg.setAttribute('alt', m.title);
    lightboxTitle.textContent = m.title;
    lightboxDesc.textContent = m.desc;
    lightboxCount.textContent = `${lbIndex + 1} / ${lbList.length}`;
    [lightboxPrev, lightboxNext].forEach((b) => b && b.classList.toggle('is-hidden', lbList.length < 2));
  }

  function stepLightbox(delta) {
    if (lbList.length < 2) return;
    lbIndex = (lbIndex + delta + lbList.length) % lbList.length;
    fillLightbox();
  }

  function openLightboxById(id) {
    lbList = momentList();
    lbIndex = Math.max(0, lbList.findIndex((m) => m.id === id));
    fillLightbox();
    openModal(lightboxModal);
  }

  if (momentsGrid) {
    momentsGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.moment-card');
      if (card) openLightboxById(card.dataset.id);
    });
    momentsGrid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.moment-card');
      if (card) {
        e.preventDefault();
        openLightboxById(card.dataset.id);
      }
    });
  }
  if (lightboxPrev) lightboxPrev.addEventListener('click', () => stepLightbox(-1));
  if (lightboxNext) lightboxNext.addEventListener('click', () => stepLightbox(1));

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
      const value = btn.dataset.phone;
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
  setService(activeServiceKey, { silent: true });
  renderMoments();
  startAuto();
  refreshAll();
  updateTotal();

  // Jadwal menyegarkan diri tiap menit (sesi yang jamnya lewat otomatis geser ke pekan depan)
  setInterval(() => {
    if (!document.hidden) {
      renderSchedule();
      updateNextSession();
    }
  }, 60000);

  // Sinkron antar-tab: reservasi dari tab lain ikut memperbarui kuota
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    try {
      bookings = JSON.parse(e.newValue) || [];
    } catch (err) {
      bookings = [];
    }
    refreshAll();
    if (myBookingsModal && myBookingsModal.classList.contains('open')) renderSavedBookings();
  });
});