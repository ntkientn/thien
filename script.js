// Global Data Cache for Quotes and Articles
let siteData = null;
// Audio context synthetic oscillator cues for Box Breathing
let audioCtx = null;
let breatheInterval = null;
let totalTimeRemaining = 0;
let totalTimerInterval = null;
let cycleTicks = 0; 
let isPracticing = false;
// Khai báo Audio Voice-over
const voiceStart = new Audio('voice/1_chao_ban_hay_ngoi_thang_lung_tha_long.mp3');
const voiceTransition = new Audio('voice/2_bay_gio_hay_buong_long_su_kiem_soat.mp3');
const voiceEnd = new Audio('voice/3_bai_thuc_tap_da_hoan_tat.mp3');

// Initialize when DOM content is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    fetchSiteData();
    renderSurveyHistory();
    
    // Tự động cập nhật nhãn số giây (4s, 5s, 6s) của các thanh tiến trình khi đổi option nhịp thở
    const paceSelect = document.getElementById("breath-pace");
    if (paceSelect) {
        updatePaceLabels(parseInt(paceSelect.value));
        paceSelect.addEventListener("change", (e) => {
            updatePaceLabels(parseInt(e.target.value));
        });
    }
});

// Hàm hỗ trợ cập nhật text hiển thị trên các thanh trạng thái dưới hình tròn
function updatePaceLabels(pace) {
    document.getElementById("phase-hit").innerText = `Hít vào (${pace}s)`;
    document.getElementById("phase-giu1").innerText = `Giữ hơi (${pace}s)`;
    document.getElementById("phase-tho").innerText = `Thở ra (${pace}s)`;
    document.getElementById("phase-giu2").innerText = `Nghỉ (${pace}s)`;
}

// Fetch Data from JSON safely
async function fetchSiteData() {
    try {
        const response = await fetch('data.json');
        siteData = await response.json();
        
        // Initial random selection
        loadRandomQuote();
        loadRandomArticle();
    } catch (error) {
        console.error("Error loading data.json file asset:", error);
    }
}

// Select a random life quote
function loadRandomQuote() {
    if (!siteData || !siteData.quotes.length) return;
    const randomIndex = Math.floor(Math.random() * siteData.quotes.length);
    const element = document.getElementById("daily-quote");
    element.classList.remove("animate-fade");
    void element.offsetWidth; // Trigger reflow to restart animation
    element.innerText = siteData.quotes[randomIndex];
    element.classList.add("animate-fade");
}

let isFirstLoad = true;
// Select a random article
function loadRandomArticle() {
    if (!siteData || !siteData.articles.length) return;
    const randomIndex = Math.floor(Math.random() * siteData.articles.length);
    const article = siteData.articles[randomIndex];
    
    const container = document.getElementById("featured-article-container");
    container.classList.remove("animate-fade");
    void container.offsetWidth; // Trigger reflow ổn định animation

    // LẬP TRÌNH PHÒNG THỦ: Kiểm tra kiểu dữ liệu của content
    let contentParagraphs = "";
    
    if (Array.isArray(article.content)) {
        // Nếu đúng là Mảng: Tiến hành lặp map() như bình thường
        contentParagraphs = article.content.map(para => {
            return `<p class="article-para" style="margin-bottom: 12px; line-height: 1.6;">${para}</p>`;
        }).join('');
    } else if (typeof article.content === "string") {
        // Nếu lỡ là Chuỗi thường: Tự động bọc vào 1 thẻ <p> duy nhất, không để app bị crash
        contentParagraphs = `<p class="article-para" style="margin-bottom: 12px; line-height: 1.6;">${article.content}</p>`;
    }

    container.innerHTML = `
        <div class="article-img-box" style="background-image: url('${article.image || ''}')"></div>
        <div class="article-body">
            <span class="article-tag">${article.category}</span>
            <h3 class="article-title" style="margin-top: 8px; margin-bottom: 5px;">${article.title}</h3>
            
            <p class="article-source" style="font-size: 13px; color: #6a8276; font-style: italic; margin-bottom: 15px;">
                ✍️ Nguồn: ${article.source}
            </p>

            <p class="article-para summary-box" style="font-weight: 600; color: #2c4a3e; margin-bottom: 15px; border-left: 3px solid #2c4a3e; padding-left: 10px;">
                ${article.summary}
            </p>
            
            <div class="article-content-main">
                ${contentParagraphs}
            </div>

            <div class="text-center" style="margin-top: 30px;">
                <button class="btn-primary" onclick="loadRandomArticle()"><span class="zoom-emoji">📖</span> Đọc bài viết khác</button>
            </div>
        </div>
    `;
    container.classList.add("animate-fade");

    // 🔥 HÀNH ĐỘNG MỚI: TỰ ĐỘNG CUỘN MÀN HÌNH LÊN ĐẦU BÀI VIẾT
    if (!isFirstLoad) {
        // Tùy vào anh đang dùng window.scrollTo hay scrollIntoView, 
        // cứ đưa đoạn code cuộn màn hình cũ vào bên trong ngoặc nhọn này.
        container.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start'      
        });
    }
    // Đánh dấu là đã tải xong lần đầu
    isFirstLoad = false;
}

// Tab switcher handler
function switchTab(tabIndex) {
    const buttons = document.querySelectorAll(".tab-button");
    buttons.forEach((btn, idx) => {
        if(idx + 1 === tabIndex) btn.classList.add("active");
        else btn.classList.remove("active");
    });

    const contents = document.querySelectorAll(".tab-content");
    contents.forEach((block, idx) => {
        if(idx + 1 === tabIndex) block.classList.add("active-content");
        else block.classList.remove("active-content");
    });

    if (tabIndex !== 2 && isPracticing) {
        togglePractice();
    }
}

/* ==========================================================================
   TAB 2: BOX BREATHING ENGINE WITH AUDIO BACKGROUND & DYNAMIC PACE
   ========================================================================== */
function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// PHẦN CẬP NHẬT TĂNG ÂM LƯỢNG TIẾNG BEEP CHUYỂN PHA
function playPhaseSound(frequency, duration, type = 'sine') {
    if (!audioCtx) return;
    try {
        let osc = audioCtx.createOscillator();
        let gainNode = audioCtx.createGain();
        
        osc.type = type;
        osc.frequency.value = frequency;
        
        // Đã tăng từ 0.12 lên 0.5 giúp âm thanh hiệu lệnh nghe rõ ràng, sắc nét hơn
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.log("Audio cue muted.");
    }
}

// Thêm biến global để theo dõi thời gian đã trôi qua
let elapsedTime = 0; 
const BREATHING_DURATION = 20; // 2 phút (120 giây)

function togglePractice() {
    initAudioContext();
    const startBtn = document.getElementById("btn-start-practice");
    const durationSelect = document.getElementById("practice-duration");
    const paceSelect = document.getElementById("breath-pace");
    const audioSelect = document.getElementById("bg-music"); 
    const bgPlayer = document.getElementById("audio-bg-player");
    
    // Lấy các DOM elements cần thao tác hiển thị/ẩn
    const phaseBadge = document.getElementById("phase-indicator");
    const pacingBars = document.getElementById("pacing-bars-container");
    const audioHint = document.getElementById("audio-hint");

    if (isPracticing) {
        // --- STOP MECHANISM ---
        clearInterval(breatheInterval);
        clearInterval(totalTimerInterval);
        isPracticing = false;
        // THÊM 3 DÒNG NÀY ĐỂ NGẮT GIỌNG ĐỌC KHI DỪNG:
        voiceStart.pause(); voiceStart.currentTime = 0;
        voiceTransition.pause(); voiceTransition.currentTime = 0;
        voiceEnd.pause(); voiceEnd.currentTime = 0;

        startBtn.innerText = "🧘 Bắt Đầu Thiền";
        startBtn.classList.remove("active-stop");
        
        resetBreathingVisuals();
        
        // Khôi phục giao diện
        phaseBadge.classList.add("hidden");
        pacingBars.classList.remove("fade-out");
        audioHint.classList.remove("fade-out");
        document.getElementById("circle-text-label").innerText = "Hơi thở";
        
        // Mở khóa cấu hình
        if(paceSelect) paceSelect.disabled = false;
        if(durationSelect) durationSelect.disabled = false;

        if (bgPlayer) {
            bgPlayer.pause();
            bgPlayer.currentTime = 0; 
        }
    } else {
        // --- START MECHANISM ---
        isPracticing = true;
        elapsedTime = 0; // Reset thời gian trôi qua
        // THÊM DÒNG NÀY ĐỂ PHÁT GIỌNG LÚC BẮT ĐẦU:
        voiceStart.play().catch(e => console.log("Trình duyệt chặn autoplay audio", e));        

        startBtn.innerText = "🛑 Dừng lại";
        startBtn.classList.add("active-stop");
        
        // Hiển thị Nhãn Giai đoạn 1
        phaseBadge.classList.remove("hidden");
        phaseBadge.innerText = "Giai đoạn 1: Luyện Thở (2 Phút)";

        // Khóa cấu hình
        if(paceSelect) paceSelect.disabled = true;
        if(durationSelect) durationSelect.disabled = true;

        const chosenPace = parseInt(paceSelect.value) || 4;
        const totalCycleSeconds = chosenPace * 4; 

        totalTimeRemaining = parseInt(durationSelect.value);
        updateTimerDisplay(totalTimeRemaining);

        // Kích hoạt phát nhạc nền
        if (bgPlayer && audioSelect && audioSelect.value !== "nature") {
            bgPlayer.src = audioSelect.value;
            bgPlayer.volume = 0.8;
            bgPlayer.loop = true;
            bgPlayer.play().catch(err => console.log("Audio play blocked:", err));
        }

        // Bắt đầu nhịp thở
        cycleTicks = 0;
        executeFixedBreathingStep(chosenPace);

        breatheInterval = setInterval(() => {
            cycleTicks = (cycleTicks + 1) % totalCycleSeconds;
            executeFixedBreathingStep(chosenPace);
        }, 1000);

        // Bộ đếm thời gian tổng
        totalTimerInterval = setInterval(() => {
            totalTimeRemaining--;
            elapsedTime++;
            updateTimerDisplay(totalTimeRemaining);

            // LOGIC CHUYỂN GIAO: Đúng 120 giây (2 phút) và thời gian tổng phải lớn hơn 2 phút
            if (elapsedTime === BREATHING_DURATION && totalTimeRemaining > 0) {
                transitionToMeditation();
            }

            // KẾT THÚC BÀI TẬP
            if(totalTimeRemaining <= 0) {
                playPhaseSound(528, 1.5, 'triangle'); 
                
                // THÊM DÒNG NÀY ĐỂ PHÁT GIỌNG KẾT THÚC:
                voiceEnd.play(); 

                togglePractice();
                
                // Thay thế alert bằng một thông báo nhẹ nhàng sau khi đọc xong (khoảng 8 giây)
                setTimeout(() => {
                    alert("Chúc mừng bạn đã hoàn thành bài thực hành thiền định nuôi dưỡng tâm an!");
                }, 8000); 
            }
        }, 1000);
    }
}

// HÀM MỚI: Xử lý khoảnh khắc chuyển giao và bắt đầu Giai đoạn 3
function transitionToMeditation() {
    // 1. Dừng ngay bộ đếm nhịp thở hộp
    clearInterval(breatheInterval);
    
    // 2. Phát một tiếng chuông dài sâu lắng (Tần số 432Hz - Healing frequency)
    playPhaseSound(432, 2.5, 'sine');
    // THÊM DÒNG NÀY ĐỂ PHÁT GIỌNG CHUYỂN GIAO:
    voiceTransition.play();

    // 3. Cập nhật UI sang Giai đoạn Chuyển giao -> Thiền định
    const phaseBadge = document.getElementById("phase-indicator");
    phaseBadge.innerText = "Giai đoạn 3: Thiền Định Chánh Niệm";
    
    document.getElementById("breath-status").innerHTML = "<b>Khoảnh Khắc Buông Xả...</b><br>Hãy để hơi thở diễn ra tự nhiên";
    document.getElementById("circle-text-label").innerText = "Tâm An";
    
    // 4. Đổi Vòng tròn sang trạng thái Zen (Tĩnh lặng, Glow)
    const node = document.getElementById("breath-node");
    node.className = "breathing-circle zen-static";
    
    // 5. Ẩn thanh Pacing (Nhịp hít/thở) và dòng nhắc nhở âm thanh cho đỡ rối mắt
    document.getElementById("pacing-bars-container").classList.add("fade-out");
    document.getElementById("audio-hint").classList.add("fade-out");
}

function updateTimerDisplay(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    document.getElementById("timer-text").innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function resetBreathingVisuals() {
    const node = document.getElementById("breath-node");
    node.style.transition = "none";
    node.className = "breathing-circle rest-static state-small";
    
    document.getElementById("breath-status").innerText = "Sẵn Sàng";
    document.querySelectorAll(".pace-phase").forEach(p => p.classList.remove("active-phase"));
}

function executeFixedBreathingStep(pace) {
    const node = document.getElementById("breath-node");
    const statusText = document.getElementById("breath-status");
    
    const phases = [
        document.getElementById("phase-hit"),
        document.getElementById("phase-giu1"),
        document.getElementById("phase-tho"),
        document.getElementById("phase-giu2")
    ];

    phases.forEach(p => p.classList.remove("active-phase"));

    // PHA 1: HÍT VÀO
    if (cycleTicks === 0) {
        phases[0].classList.add("active-phase");
        statusText.innerText = `Hít Vào (${pace}s)...`;
        playPhaseSound(784, 0.2); // Tăng từ 392Hz lên 784Hz (Nốt G5) 
        node.style.transition = "none";
        node.className = "breathing-circle inhale-active state-small";
        
        void node.offsetWidth; 
        
        node.style.transition = `width ${pace}s linear, height ${pace}s linear, background-color ${pace}s linear`;
        node.className = "breathing-circle inhale-active state-large";
    } 
    else if (cycleTicks > 0 && cycleTicks < pace) {
        phases[0].classList.add("active-phase");
    }
    // PHA 2: GIỮ HƠI
    else if (cycleTicks === pace) {
        phases[1].classList.add("active-phase");
        statusText.innerText = `Giữ Hơi Thở (${pace}s)`;
        playPhaseSound(659, 0.2); // Tăng từ 330Hz lên 659Hz (Nốt E5) - Nghe rất rõ và thanh thoát

        node.style.transition = "none";
        node.className = "breathing-circle hold-static state-large"; 
    } 
    else if (cycleTicks > pace && cycleTicks < pace * 2) {
        phases[1].classList.add("active-phase");
    }
    // PHA 3: THỞ RA
    else if (cycleTicks === pace * 2) {
        phases[2].classList.add("active-phase");
        statusText.innerText = `Thở Ra Từ Từ (${pace}s)...`;
        playPhaseSound(523, 0.2); // Tăng từ 261Hz lên 523Hz (Nốt C5)

        node.style.transition = "none";
        node.className = "breathing-circle exhale-active state-large";
        
        void node.offsetWidth; 
        
        node.style.transition = `width ${pace}s linear, height ${pace}s linear, background-color ${pace}s linear`;
        node.className = "breathing-circle exhale-active state-small";
    } 
    else if (cycleTicks > pace * 2 && cycleTicks < pace * 3) {
        phases[2].classList.add("active-phase");
    }
    // PHA 4: NGHỈ TĨNH LẶNG
    else if (cycleTicks === pace * 3) {
        phases[3].classList.add("active-phase");
        statusText.innerText = `Nghỉ Tĩnh Lặng (${pace}s)`;
        playPhaseSound(440, 0.2); // FIX: Tăng từ 220Hz lên 440Hz (Nốt A4 chuẩn)

        node.style.transition = "none";
        node.className = "breathing-circle rest-static state-small"; 
    }
    else if (cycleTicks > pace * 3 && cycleTicks < pace * 4) {
        phases[3].classList.add("active-phase");
    }
}

/* ==========================================================================
   TAB 3: SURVEY SYSTEM
   ========================================================================== */
function processSurvey(event) {
    event.preventDefault();
    const formData = new FormData(document.getElementById("mindfulness-form"));
    
    let totalScore = 0;
    for (let i = 1; i <= 10; i++) {
        const val = formData.get(`q${i}`);
        if(val) totalScore += parseInt(val);
    }

    let state = "";
    let advice = "";

    if (totalScore <= 18) {
        state = "Tâm Trí Bình Ổn & An Nhiên";
        advice = "Tuyệt vời! Tâm trí bạn đang có khả năng tự cân bằng sâu sắc. Tiếp tục duy trì 5-10 phút thiền thở Box Breathing hàng ngày.";
    } else if (totalScore <= 28) {
        state = "Tâm Trí Bất An Nhẹ & Stress Tích Tụ";
        advice = "Cảnh báo nhẹ: Bạn có dấu hiệu mệt mỏi. Mở Tab 2 thực hành ngay bài thở sâu khi cảm thấy nóng giận.";
    } else {
        state = "Tâm Trí Quá Tải / Cần Chữa Lành";
        advice = "Báo động: Bạn đang lo âu sâu sắc. Cần ưu tiên thiền buông thư toàn thân (Tab 2) và đọc kỹ bài viết Tab 1.";
    }

    document.getElementById("score-number").innerText = `${totalScore} / 40`;
    document.getElementById("score-status-text").innerText = state;
    document.getElementById("advice-text").innerText = advice;
    document.getElementById("survey-result-box").classList.remove("hidden");

    saveToHistory(totalScore, state);
    document.getElementById("survey-result-box").scrollIntoView({ behavior: 'smooth' });
}

function saveToHistory(score, state) {
    let history = JSON.parse(localStorage.getItem("meditation_survey_history")) || [];
    history.unshift({
        date: new Date().toLocaleString('vi-VN', { hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit' }),
        score: score,
        state: state
    });
    if(history.length > 7) history.pop();
    localStorage.setItem("meditation_survey_history", JSON.stringify(history));
    renderSurveyHistory();
}

function renderSurveyHistory() {
    const list = document.getElementById("history-list");
    let history = JSON.parse(localStorage.getItem("meditation_survey_history")) || [];
    if(history.length === 0) {
        list.innerHTML = `<li class="empty-history">Chưa có dữ liệu khảo sát.</li>`;
        return;
    }
    list.innerHTML = history.map(item => `<li><div><strong>${item.score}đ</strong> - ${item.state}</div><span style="font-size:11px;color:#999;">${item.date}</span></li>`).join('');
}

function clearSurveyHistory() {
    if(confirm("Xóa lịch sử khảo sát?")) {
        localStorage.removeItem("meditation_survey_history");
        renderSurveyHistory();
    }
}