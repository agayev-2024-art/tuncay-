const listenButton = document.querySelector('#listenButton');
const listenLabel = document.querySelector('#listenLabel');
const hintText = document.querySelector('#hintText');
const transcript = document.querySelector('#transcript');
const status = document.querySelector('#connectionStatus');
const recordingStatus = document.querySelector('#recordingStatus');
const downloadArea = document.querySelector('#downloadArea');
const cameraPreview = document.querySelector('#cameraPreview');
const cameraPlaceholder = document.querySelector('#cameraPlaceholder');
const cameraButton = document.querySelector('#cameraButton');
const snapshotButton = document.querySelector('#snapshotButton');
const voiceSelect = document.querySelector('#voiceSelect');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let mediaRecorder;
let mediaStream;
let recordingType;
let recordingChunks = [];
let cameraStream;
let wakeMode = false;
let currentLanguage = 'tr-TR';
let musicPlaying = false;
let availableVoices = [];
let selectedVoiceName = '';
let responseStyle = 'balanced';
let speechEnabled = true;
let settings = JSON.parse(localStorage.getItem('jarvis-settings') || '{}');
const plugins = new Map();

function registerPlugin(name, handler) {
  plugins.set(name, handler);
  document.querySelector('#pluginStatus').textContent = `Plugin çekirdeği hazır · ${plugins.size} eklenti`;
}

function speak(text) {
  if (!speechEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = currentLanguage;
  utterance.rate = responseStyle === 'brief' ? 0.98 : currentLanguage === 'az-AZ' ? 0.94 : 0.92;
  utterance.pitch = 0.94;
  const preferredVoice = availableVoices.find((voice) => voice.name === selectedVoiceName)
    || availableVoices.find((voice) => voice.lang.toLowerCase().startsWith(currentLanguage.slice(0, 2).toLowerCase()))
    || availableVoices.find((voice) => voice.lang.toLowerCase().startsWith('tr'));
  if (preferredVoice) utterance.voice = preferredVoice;
  utterance.onstart = () => { listenButton.classList.add('is-speaking'); status.textContent = 'DANIŞIR'; };
  utterance.onend = () => { listenButton.classList.remove('is-speaking'); if (!listenButton.classList.contains('is-listening')) status.textContent = wakeMode ? 'OYAQ' : 'HAZIR'; };
  window.speechSynthesis.speak(utterance);
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
}

function saveSettings() {
  const values = {
    language: document.querySelector('#settingsLanguage').value,
    responseStyle: document.querySelector('#responseStyle').value,
    speechEnabled: document.querySelector('#speechToggle').checked,
    theme: document.querySelector('#themeSelect').value,
    notifications: document.querySelector('#notificationToggle').checked,
    automation: document.querySelector('#automationToggle').checked,
    pinEnabled: document.querySelector('#pinToggle').checked,
    voiceAuth: document.querySelector('#voiceAuthToggle').checked,
    homeAutomation: document.querySelector('#homeAutomationToggle').checked,
    homeMode: document.querySelector('#homeMode').value,
    tempLimit: document.querySelector('#tempLimit').value,
    spotify: document.querySelector('#spotifyToggle').checked,
    calendar: document.querySelector('#calendarToggle').checked,
    webSearch: document.querySelector('#webSearchToggle').checked,
    developer: document.querySelector('#developerToggle').checked,
    apiEndpoint: document.querySelector('#apiEndpoint').value
  };
  localStorage.setItem('jarvis-settings', JSON.stringify(values));
  settings = values;
  currentLanguage = values.language;
  responseStyle = values.responseStyle;
  speechEnabled = values.speechEnabled;
  if (recognition) recognition.lang = currentLanguage;
  applyTheme(values.theme);
  document.querySelector('#developerLog').textContent = values.developer ? `LOG AKTİF · API: ${values.apiEndpoint || 'lokal'} · ${new Date().toLocaleTimeString()}` : 'Sistem logları deaktivdir';
  document.querySelector('#securityStatus').textContent = values.pinEnabled || values.voiceAuth ? 'Qoruma aktivdir' : 'Qoruma deaktivdir';
}

function loadSettings() {
  const defaults = { language: 'az-AZ', responseStyle: 'balanced', speechEnabled: true, theme: 'command', notifications: true, automation: true, pinEnabled: false, voiceAuth: false, homeAutomation: false, homeMode: 'local', tempLimit: 24, spotify: false, calendar: true, webSearch: true, developer: false, apiEndpoint: '' };
  const values = { ...defaults, ...settings };
  document.querySelector('#settingsLanguage').value = values.language;
  document.querySelector('#responseStyle').value = values.responseStyle;
  document.querySelector('#speechToggle').checked = values.speechEnabled;
  document.querySelector('#themeSelect').value = values.theme;
  document.querySelector('#notificationToggle').checked = values.notifications;
  document.querySelector('#automationToggle').checked = values.automation;
  document.querySelector('#pinToggle').checked = values.pinEnabled;
  document.querySelector('#voiceAuthToggle').checked = values.voiceAuth;
  document.querySelector('#homeAutomationToggle').checked = values.homeAutomation;
  document.querySelector('#homeMode').value = values.homeMode;
  document.querySelector('#tempLimit').value = values.tempLimit;
  document.querySelector('#spotifyToggle').checked = values.spotify;
  document.querySelector('#calendarToggle').checked = values.calendar;
  document.querySelector('#webSearchToggle').checked = values.webSearch;
  document.querySelector('#developerToggle').checked = values.developer;
  document.querySelector('#apiEndpoint').value = values.apiEndpoint;
  currentLanguage = values.language; responseStyle = values.responseStyle; speechEnabled = values.speechEnabled; applyTheme(values.theme);
}

async function hashPin(pin) {
  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

loadSettings();

function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  availableVoices = window.speechSynthesis.getVoices();
  const matchingVoices = availableVoices.filter((voice) => /^(tr|az|en)/i.test(voice.lang));
  voiceSelect.innerHTML = '<option value="">Avtomatik səs</option>';
  matchingVoices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} · ${voice.lang}`;
    voiceSelect.append(option);
  });
}
if ('speechSynthesis' in window) { loadVoices(); window.speechSynthesis.addEventListener('voiceschanged', loadVoices); }

function addMessage(type, text) {
  const emptyState = transcript.querySelector('.empty-state');
  if (emptyState) emptyState.remove();
  const message = document.createElement('div');
  message.className = `message ${type}`;
  message.innerHTML = `<span class="message-tag">${type === 'user' ? 'SEN' : 'JARVIS'}</span><span>${text}</span>`;
  transcript.append(message);
  transcript.scrollTop = transcript.scrollHeight;
}

function showSystemStatus() {
  const parts = [`Platformun ${navigator.platform || 'bilinmiyor'}`, `ekranın ${window.screen.width} x ${window.screen.height} piksel`];
  if (navigator.deviceMemory) parts.push(`yaklaşık ${navigator.deviceMemory} GB bellek`);
  const response = `${parts.join(', ')}. Pil bilgisini de panelde güncelledim.`;
  addMessage('assistant', response);
  speak(response);
}

function runCommand(command) {
  const normalized = command.toLocaleLowerCase('tr-TR').trim();
  addMessage('user', command);
  if (normalized.includes('saat') || normalized.includes('vaxt')) {
    const now = new Date();
    const time = new Intl.DateTimeFormat('tr-TR', { hour: 'numeric', minute: '2-digit' }).format(now);
    const response = `Şu an saat ${time}.`;
    addMessage('assistant', response); speak(response);
  } else if (normalized.includes('hatırlat') || normalized.includes('xatırlat')) {
    const reminderText = command.replace(/hatırlat|xatırlat/gi, '').trim() || 'Bir görev';
    const minuteMatch = normalized.match(/(\d+)\s*(dakika|dəqiqə)/);
    createReminder(reminderText, minuteMatch ? Number(minuteMatch[1]) : 1);
  } else if (normalized.includes('not al') || normalized.includes('qeyd al')) {
    saveNote(command.replace(/not al|qeyd al/gi, '').trim() || command);
  } else if (normalized.includes('müzik') || normalized.includes('musiqi')) {
    musicPlaying = true;
    document.querySelector('#musicTitle').textContent = 'Müzik çalıyor · Jarvis mix';
    const response = currentLanguage === 'az-AZ' ? 'Musiqi rejimini başladım.' : 'Müzik modunu başlattım.';
    addMessage('assistant', response); speak(response);
  } else if (normalized.includes('duraklat') || normalized.includes('dayandır') || normalized.includes('pause')) {
    musicPlaying = false;
    document.querySelector('#musicTitle').textContent = 'Müzik duraklatıldı';
    const response = currentLanguage === 'az-AZ' ? 'Musiqini dayandırdım.' : 'Müziği duraklattım.';
    addMessage('assistant', response); speak(response);
  } else if (normalized.includes('program aç') || normalized.includes('proqram aç')) {
    const response = currentLanguage === 'az-AZ' ? 'Brauzerdən masaüstü proqramlarını birbaşa aça bilmirəm. İstədiyin proqramın adını de, uyğun rəsmi səhifəsini aça bilərəm.' : 'Tarayıcıdan masaüstü programlarını doğrudan açamam. Programın adını söyle, resmi sayfasını açabilirim.';
    addMessage('assistant', response); speak(response);
  } else if (normalized.includes('dosya sil') || normalized.includes('fayl sil')) {
    const response = currentLanguage === 'az-AZ' ? 'Faylları icazəsiz silmirəm. Faylı seçib təsdiqləyən təhlükəsiz bir masaüstü tətbiqi lazımdır.' : 'Dosyaları izinsiz silmem. Dosyayı seçip onaylayan güvenli bir masaüstü uygulaması gerekir.';
    addMessage('assistant', response); speak(response);
  } else if (normalized.includes('durum') || normalized.includes('bilgisayar') || normalized.includes('sistem')) {
    showSystemStatus();
  } else if (normalized.includes('google') || normalized.includes('ara') || normalized.includes('aç')) {
    const query = normalized.replace(/google'da|googlede|google|ara|aç|ac/gi, '').trim() || 'en son haberler';
    const response = currentLanguage === 'az-AZ' ? `Google-da ${query} üçün axtarış açıram.` : `Google'da ${query} için arama açıyorum.`;
    addMessage('assistant', response); speak(response);
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener');
  } else {
    const response = currentLanguage === 'az-AZ' ? `Bu mövzu barədə ən yeni məlumatı Google-da axtarıram: ${command}.` : `Bu konuda en güncel bilgiyi Google'da arıyorum: ${command}.`;
    addMessage('assistant', response); speak(response);
    window.open(`https://www.google.com/search?q=${encodeURIComponent(command)}`, '_blank', 'noopener');
  }
}

function createReminder(text, minutes) {
  const dueAt = new Date(Date.now() + minutes * 60000);
  const response = currentLanguage === 'az-AZ' ? `${text} üçün xatırlatma qurdum.` : `${text} için hatırlatma kurdum.`;
  addMessage('assistant', response); speak(response);
  window.setTimeout(() => { speak(`${text}.`); addMessage('assistant', `⏰ ${text}`); }, minutes * 60000);
  return dueAt;
}

function saveNote(text) {
  const notes = JSON.parse(localStorage.getItem('jarvis-notes') || '[]');
  notes.unshift({ text, createdAt: new Date().toLocaleString(currentLanguage) });
  localStorage.setItem('jarvis-notes', JSON.stringify(notes.slice(0, 20)));
  renderNotes();
  const response = currentLanguage === 'az-AZ' ? 'Qeydi yadda saxladım.' : 'Notu kaydettim.';
  addMessage('assistant', response); speak(response);
}

function renderNotes() {
  const notesList = document.querySelector('#notesList');
  notesList.innerHTML = JSON.parse(localStorage.getItem('jarvis-notes') || '[]').slice(0, 3).map((note) => `<div>${note.text}</div>`).join('');
}

function downloadCalendarEvent(title, dateValue) {
  const date = new Date(dateValue);
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `DTSTART:${stamp}`, `SUMMARY:${title.replace(/[,;]/g, ' ')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  link.download = `jarvis-${Date.now()}.ics`;
  link.click();
  document.querySelector('#eventStatus').textContent = 'Takvim dosyası hazır';
  addMessage('assistant', `${title} için takvim dosyasını hazırladım.`);
}

registerPlugin('genel-arama', (command) => command);

function toggleListening() {
  if (!recognition) { hintText.textContent = 'Bu tarayıcı sesli komutları desteklemiyor'; return; }
  recognition.start();
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = currentLanguage; recognition.interimResults = false; recognition.maxAlternatives = 1;
  recognition.onstart = () => { listenButton.classList.add('is-listening'); listenLabel.textContent = 'DİNLİYOR'; status.textContent = 'DİNLİYOR'; hintText.textContent = 'Komutunu söyle'; };
  recognition.onend = () => { listenButton.classList.remove('is-listening'); listenLabel.textContent = 'DİNLE'; status.textContent = 'HAZIR'; hintText.textContent = 'Mikrofonu açmak için butona dokun'; };
  recognition.onerror = () => { hintText.textContent = 'Mikrofon izni verilmedi veya ses alınamadı'; };
  recognition.onresult = (event) => runCommand(event.results[0][0].transcript);
}

listenButton.addEventListener('click', toggleListening);
document.querySelector('#clearButton').addEventListener('click', () => {
  transcript.innerHTML = '<div class="empty-state"><span class="empty-icon">◌</span><p>Henüz bir komut yok.</p><small>Örnek: “Saat kaç?” veya “Google’da müzik ara.”</small></div>';
});
document.querySelectorAll('.quick-action').forEach((button) => button.addEventListener('click', () => runCommand(button.dataset.command)));

document.querySelector('#languageSelect').addEventListener('change', (event) => {
  currentLanguage = event.target.value;
  document.querySelector('#settingsLanguage').value = currentLanguage;
  if (recognition) recognition.lang = currentLanguage;
  const response = currentLanguage === 'az-AZ' ? 'Azərbaycan dili aktivdir. Sizi dinləyirəm.' : 'Türkçe aktif. Seni dinliyorum.';
  addMessage('assistant', response); speak(response);
});
voiceSelect.addEventListener('change', (event) => {
  selectedVoiceName = event.target.value;
  const response = selectedVoiceName ? 'Ses profilini değiştirdim.' : 'En uygun sesi otomatik seçiyorum.';
  addMessage('assistant', response); speak(response);
});
document.querySelector('#settingsLanguage').addEventListener('change', (event) => {
  document.querySelector('#languageSelect').value = event.target.value;
  currentLanguage = event.target.value;
  if (recognition) recognition.lang = currentLanguage;
});
document.querySelector('#responseStyle').addEventListener('change', (event) => { responseStyle = event.target.value; });
document.querySelector('#speechToggle').addEventListener('change', (event) => { speechEnabled = event.target.checked; if (!speechEnabled) window.speechSynthesis?.cancel(); });
document.querySelector('#themeSelect').addEventListener('change', (event) => applyTheme(event.target.value));
document.querySelector('#developerToggle').addEventListener('change', (event) => { document.querySelector('#developerLog').textContent = event.target.checked ? 'LOG AKTİF · dəyişikliklər izlənir' : 'Sistem logları deaktivdir'; });
document.querySelector('#savePinButton').addEventListener('click', async () => {
  const pin = document.querySelector('#pinInput').value.trim();
  const statusText = document.querySelector('#securityStatus');
  if (!/^\d{4,6}$/.test(pin)) { statusText.textContent = 'PIN 4-6 rəqəm olmalıdır'; return; }
  localStorage.setItem('jarvis-pin-hash', await hashPin(pin));
  document.querySelector('#pinInput').value = '';
  statusText.textContent = 'PIN lokal olaraq yadda saxlanıldı';
});
const authOverlay = document.querySelector('#authOverlay');
const authMessage = document.querySelector('#authMessage');
document.querySelector('#loginButton').addEventListener('click', () => {
  authOverlay.hidden = false;
  document.querySelector('#authPin').focus();
  authMessage.textContent = localStorage.getItem('jarvis-pin-hash') ? 'Davam etmək üçün PIN kodunu daxil et.' : 'Əvvəlcə Ayarlar bölməsindən PIN təyin et.';
});
document.querySelector('#closeAuthButton').addEventListener('click', () => { authOverlay.hidden = true; });
document.querySelector('#authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const savedHash = localStorage.getItem('jarvis-pin-hash');
  const input = document.querySelector('#authPin');
  if (!savedHash) { authMessage.textContent = 'PIN qurulmayıb. Ayarlardan PIN təyin et.'; return; }
  if (await hashPin(input.value) === savedHash) {
    authMessage.textContent = 'Giriş təsdiqləndi. Xoş gəldin.';
    document.querySelector('#loginButton').textContent = 'Daxil oldu';
    authOverlay.hidden = true;
    input.value = '';
  } else { authMessage.textContent = 'PIN yanlışdır. Yenidən yoxla.'; input.select(); }
});
document.querySelector('#saveSettingsButton').addEventListener('click', () => { saveSettings(); addMessage('assistant', currentLanguage === 'az-AZ' ? 'Ayarları yadda saxladım.' : 'Ayarları kaydettim.'); speak(currentLanguage === 'az-AZ' ? 'Ayarları yadda saxladım.' : 'Ayarları kaydettim.'); });
document.querySelector('#chatForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.querySelector('#chatInput');
  if (input.value.trim()) runCommand(input.value.trim());
  input.value = '';
});
document.querySelector('#reminderForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = document.querySelector('#reminderText').value.trim();
  const due = new Date(document.querySelector('#reminderTime').value);
  const delay = Math.max(0, due.getTime() - Date.now());
  const notificationsEnabled = document.querySelector('#notificationToggle').checked;
  if (notificationsEnabled && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  const response = currentLanguage === 'az-AZ' ? `${text} üçün xatırlatma quruldu.` : `${text} için hatırlatma kuruldu.`;
  addMessage('assistant', response); speak(response);
  window.setTimeout(() => { if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') new Notification('JARVIS', { body: text }); addMessage('assistant', `⏰ ${text}`); speak(text); }, delay);
});
document.querySelector('#noteForm').addEventListener('submit', (event) => { event.preventDefault(); const input = document.querySelector('#noteText'); saveNote(input.value.trim()); input.value = ''; });
document.querySelector('#calendarForm').addEventListener('submit', (event) => { event.preventDefault(); downloadCalendarEvent(document.querySelector('#eventText').value.trim(), document.querySelector('#eventTime').value); });
document.querySelector('#musicPlay').addEventListener('click', () => runCommand('müzik aç'));
document.querySelector('#musicPause').addEventListener('click', () => runCommand('müziği duraklat'));
document.querySelector('#musicNext').addEventListener('click', () => { document.querySelector('#musicTitle').textContent = 'Sonraki parça seçildi'; speak('Sonraki parçaya geçtim.'); });
renderNotes();

async function toggleCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    cameraPreview.hidden = true;
    cameraPlaceholder.hidden = false;
    cameraButton.textContent = 'Kamerayı aç';
    snapshotButton.disabled = true;
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraPreview.srcObject = cameraStream;
    cameraPreview.hidden = false;
    cameraPlaceholder.hidden = true;
    cameraButton.textContent = 'Kamerayı kapat';
    snapshotButton.disabled = false;
    speak('Kamera hazır. Karşımdaki görüntüyü inceleyebilirim.');
  } catch (error) {
    addMessage('assistant', 'Kamera izni verilmedi. Görüntüyü açmak için tarayıcı iznini kullan.');
  }
}

function takeSnapshot() {
  if (!cameraStream) return;
  const canvas = document.createElement('canvas');
  canvas.width = cameraPreview.videoWidth || 1280;
  canvas.height = cameraPreview.videoHeight || 720;
  canvas.getContext('2d').drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);
  const link = document.createElement('a');
  link.download = `jarvis-kamera-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  addMessage('assistant', 'Kamera görüntüsünü PNG olarak kaydettim.');
  speak('Görüntüyü kaydettim.');
}

async function takeScreenshot() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    stream.getTracks().forEach((track) => track.stop());
    const link = document.createElement('a');
    link.download = `jarvis-ekran-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    addMessage('assistant', 'Ekran görüntüsünü PNG olarak kaydettim.');
    speak('Ekran görüntüsünü kaydettim.');
  } catch (error) {
    addMessage('assistant', 'Ekran görüntüsü için paylaşım izni verilmedi.');
  }
}

cameraButton.addEventListener('click', toggleCamera);
snapshotButton.addEventListener('click', takeSnapshot);
document.querySelector('#screenshotButton').addEventListener('click', takeScreenshot);
document.querySelector('#temperatureSlider').addEventListener('input', (event) => { document.querySelector('#temperatureValue').textContent = `${event.target.value}°`; });
document.querySelectorAll('.home-controls input').forEach((input) => input.addEventListener('change', () => { const device = input.id === 'lightToggle' ? 'Işık' : 'Fan'; const state = input.checked ? 'açıldı' : 'kapatıldı'; addMessage('assistant', `${device} ${state}. Bu demo bağlantısında komut hazır.`); speak(`${device} ${state}.`); }));

const wakeButton = document.querySelector('#wakeButton');
wakeButton.addEventListener('click', () => {
  wakeMode = !wakeMode;
  wakeButton.classList.toggle('active', wakeMode);
  document.querySelector('#wakeLabel').textContent = wakeMode ? '“Hey JARVIS” dinleniyor' : '“Hey JARVIS” uyanık modu';
  if (wakeMode && recognition) recognition.start();
  speak(wakeMode ? 'Hey Jarvis modu aktif. Seni dinliyorum.' : 'Hey Jarvis modu kapandı.');
});

function setRecordingState(button, active, label) {
  button.classList.toggle('is-recording', active);
  button.innerHTML = active ? `<span class="record-square"></span> ${label} durdur` : `<span class="${recordingType === 'screen' ? 'record-square' : 'record-dot'}"></span> ${label}`;
}

function finishRecording() {
  const blob = new Blob(recordingChunks, { type: mediaRecorder.mimeType || 'video/webm' });
  const url = URL.createObjectURL(blob);
  const fileName = `jarvis-${recordingType}-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.webm`;
  const button = recordingType === 'screen' ? screenRecordButton : audioRecordButton;
  setRecordingState(button, false, recordingType === 'screen' ? 'Ekran kaydı' : 'Ses kaydı');
  downloadArea.hidden = false;
  downloadArea.innerHTML = `<a href="${url}" download="${fileName}">⬇ ${recordingType === 'screen' ? 'Ekran kaydını' : 'Ses kaydını'} indir</a>`;
  recordingStatus.textContent = 'Kayıt hazır';
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
}

async function toggleRecording(type, button) {
  if (mediaRecorder?.state === 'recording') {
    if (recordingType === type) mediaRecorder.stop();
    return;
  }
  try {
    recordingType = type;
    mediaStream = type === 'screen'
      ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      : await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = (event) => { if (event.data.size) recordingChunks.push(event.data); };
    mediaRecorder.onstop = finishRecording;
    mediaRecorder.start();
    setRecordingState(button, true, type === 'screen' ? 'Ekran kaydını' : 'Ses kaydını');
    recordingStatus.textContent = type === 'screen' ? 'Ekran kaydediliyor' : 'Ses kaydediliyor';
    speak(type === 'screen' ? 'Ekran kaydı başladı.' : 'Ses kaydı başladı.');
    if (type === 'screen') mediaStream.getVideoTracks()[0].addEventListener('ended', () => { if (mediaRecorder.state === 'recording') mediaRecorder.stop(); });
  } catch (error) {
    recordingStatus.textContent = 'İzin verilmedi';
    addMessage('assistant', `${type === 'screen' ? 'Ekran' : 'Ses'} kaydı için izin verilmedi.`);
  }
}

const audioRecordButton = document.querySelector('#audioRecordButton');
const screenRecordButton = document.querySelector('#screenRecordButton');
audioRecordButton.addEventListener('click', () => toggleRecording('audio', audioRecordButton));
screenRecordButton.addEventListener('click', () => toggleRecording('screen', screenRecordButton));

let hasWelcomed = false;
function welcomeJarvis() {
  if (hasWelcomed) return;
  hasWelcomed = true;
  const response = 'Merhaba. Ben Jarvis. Türkçe konuşabilirim; saat, bilgisayar durumu ve genel bilgi sorularında yanındayım.';
  addMessage('assistant', response);
  speak(response);
}
document.addEventListener('pointerdown', welcomeJarvis, { once: true });

function updateMetrics() {
  const now = new Date();
  document.querySelector('#clockValue').textContent = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(now);
  document.querySelector('#dateValue').textContent = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  document.querySelector('#platformValue').textContent = navigator.platform || 'web';
  document.querySelector('#screenValue').textContent = `${window.screen.width}×${window.screen.height}`;
  document.querySelector('#cpuValue').textContent = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} çekirdek` : 'N/A';
  document.querySelector('#memoryValue').textContent = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'N/A';
}
updateMetrics();
setInterval(updateMetrics, 30000);
if (navigator.getBattery) navigator.getBattery().then((battery) => {
  const updateBattery = () => { document.querySelector('#batteryValue').textContent = `${Math.round(battery.level * 100)}%`; document.querySelector('#batterySub').textContent = battery.charging ? 'şarj oluyor' : 'şarjda değil'; };
  updateBattery(); battery.addEventListener('levelchange', updateBattery); battery.addEventListener('chargingchange', updateBattery);
}); else { document.querySelector('#batteryValue').textContent = 'N/A'; document.querySelector('#batterySub').textContent = 'tarayıcı desteklemiyor'; }