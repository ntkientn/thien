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

// TỪ ĐIỂN QUY ƯỚC NHÓM LỢI ÍCH (Để phân loại và tô màu)
// === CẤU HÌNH DATA GỐC CHO HỆ THỐNG LỢI ÍCH (SINGLE SOURCE OF TRUTH) ===
const BENEFITS_CONFIG = [
    {
        categoryTitle: "Tâm trí & Cảm xúc", 
        items: [
            { value: "Nhẹ nhõm & Buông xả", label: "🍃 Nhẹ nhõm & Buông xả", groupClass: "emotional" },
            { value: "Tâm trí sáng tỏ", label: "☀️ Tâm trí sáng tỏ", groupClass: "emotional" },
            { value: "Tươi mới & Tỉnh thức", label: "✨ Tươi mới & Tỉnh thức", groupClass: "emotional" },
            { value: "Tái tạo năng lượng", label: "💪 Tái tạo năng lượng", groupClass: "emotional" }
        ]
    },
    {
        categoryTitle: "Thể chất",
        items: [
            { value: "Nhịp tim hơi thở bình ổn", label: "💗 Nhịp tim hơi thở bình ổn", groupClass: "physical" },
            { value: "Cơ thể thư thái", label: "🧘 Cơ thể thư thái", groupClass: "physical" },
            { value: "Giảm cơn đau mỏi", label: "🫧 Giảm cơn đau mỏi", groupClass: "physical" },
            { value: "Phục hồi thể lực", label: "🏃‍♂️ Phục hồi thể lực", groupClass: "physical" }
        ]
    },
    {
        categoryTitle: "Năng lực & Nhận thức",
        items: [
            { value: "Tập trung tư duy sâu", label: "🎯 Tập trung tư duy sâu", groupClass: "core" },
            { value: "Định tâm vững chãi", label: "⛰️ Định tâm vững chãi", groupClass: "core" },
            { value: "Khơi sáng trực giác", label: "💡 Khơi sáng trực giác", groupClass: "core" },
            { value: "Chánh niệm, trọn vẹn hiện tại", label: "💠 Chánh niệm, trọn vẹn hiện tại", groupClass: "core" }
        ]
    }
];

// Tự động sinh ra bộ từ điển tra cứu màu sắc (Không cần viết lại BENEFIT_GROUPS thủ công nữa)
const BENEFIT_COLOR_MAP = {};
BENEFITS_CONFIG.forEach(category => {
    category.items.forEach(item => {
        BENEFIT_COLOR_MAP[item.value] = item.groupClass;
    });
});

// Hàm tự động sinh các nút bấm benefit vào Modal kết thúc thiền
function renderBenefitChipsUI() {
    const container = document.getElementById('benefit-chips');
    if (!container) return;
    
    let htmlContent = '';
    
    BENEFITS_CONFIG.forEach(category => {
        // 1. In ra Tiêu đề nhóm (Nhỏ, in hoa, màu xám thanh lịch)
        htmlContent += `
            <div style="width: 100%; text-align: center; margin-top: 10px; margin-bottom: 6px; position: relative;">
                <span style="background: #fdfaf6; padding: 0 10px; font-size: 11px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; position: relative; z-index: 1;">
                    ${category.categoryTitle}
                </span>
                <div style="position: absolute; top: 50%; left: 10%; right: 10%; height: 1px; background: #eaeaea; z-index: 0;"></div>
            </div>
        `;
        
        // 2. Bọc các nút của nhóm này vào một flexbox để nó hiển thị sát nhau
        htmlContent += `<div class="chip-group-container">`;
        
        category.items.forEach(item => {
            htmlContent += `<button class="chip" data-value="${item.value}">${item.label}</button>`;
        });
        
        htmlContent += `</div>`; // Đóng flexbox của nhóm
    });
    
    container.innerHTML = htmlContent;
}

// Biến lưu trữ ID của Practice History record đang được Edit (nếu có)
let editingRecordId = null;

// Initialize when DOM content is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    fetchSiteData();
    renderSurveyHistory();
    renderPracticeHistory();
    renderBenefitChipsUI(); // Vẽ UI cho các nút chọn giá trị đạt được sau khi thiền
    
    // THÊM ĐOẠN NÀY: Tự động khôi phục lại Tab đang đứng trước khi Refresh
    const savedActiveTab = localStorage.getItem('activeTab');
    if (savedActiveTab) {
        // Tìm nút bấm tab tương ứng và giả lập cú click chuột để kích hoạt nó
        switchTab(parseInt(savedActiveTab));
    }

    // Tự động cập nhật nhãn số giây của thanh tiến trình 
    const paceSelect = document.getElementById("breath-pace");
    if (paceSelect) {
        updatePaceLabels(parseInt(paceSelect.value));
        paceSelect.addEventListener("change", (e) => {
            updatePaceLabels(parseInt(e.target.value));
        });
    }

    // THÊM MỚI: Tự động cập nhật số phút hiển thị khi đổi thời lượng bài tập
    const durationSelect = document.getElementById("practice-duration");
    if (durationSelect) {
        // Cập nhật ngay lần đầu tải trang để chắc chắn đồng bộ
        updateTimerDisplay(parseInt(durationSelect.value)); 
        
        // Cập nhật mỗi khi user thay đổi option
        durationSelect.addEventListener("change", (e) => {
            if (!isPracticing) { // Chỉ update khi đang không thiền
                updateTimerDisplay(parseInt(e.target.value));
            }
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
    // THÊM DÒNG NÀY: Ghi nhớ Tab hiện tại đang mở
    localStorage.setItem('activeTab', tabIndex);
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
const BREATHING_DURATION = 120; // 2 phút (120 giây)

function togglePractice() {
    initAudioContext();
    const startBtn = document.getElementById("btn-start-practice");
    const durationSelect = document.getElementById("practice-duration");
    const paceSelect = document.getElementById("breath-pace");
    const audioSelect = document.getElementById("bg-music"); 
    const bgPlayer = document.getElementById("audio-bg-player");
    
    const phaseBadge = document.getElementById("phase-indicator");
    const pacingBars = document.getElementById("pacing-bars-container");
    const audioHint = document.getElementById("audio-hint");

    if (isPracticing) {
        // --- STOP MECHANISM ---
        clearInterval(breatheInterval);
        clearInterval(totalTimerInterval);
        isPracticing = false;
        
        // Tắt voice nếu đang đọc dở
        voiceStart.pause(); voiceStart.currentTime = 0;
        voiceTransition.pause(); voiceTransition.currentTime = 0;
        voiceEnd.pause(); voiceEnd.currentTime = 0;
        
        startBtn.innerText = "🧘 Bắt Đầu Thiền";
        startBtn.classList.remove("active-stop");
        
        resetBreathingVisuals();
        // Khôi phục lại mặt đồng hồ theo đúng option đang chọn
        updateTimerDisplay(parseInt(durationSelect.value));

        phaseBadge.classList.add("hidden");
        pacingBars.classList.remove("fade-out");
        audioHint.classList.remove("fade-out");
        document.getElementById("circle-text-label").innerText = "Hơi thở";
        
        if(paceSelect) paceSelect.disabled = false;
        if(durationSelect) durationSelect.disabled = false;

        if (bgPlayer) {
            bgPlayer.pause();
            bgPlayer.currentTime = 0; 
        }
    } else {
        // --- START MECHANISM ---
        isPracticing = true;
        elapsedTime = 0; 
        
        startBtn.innerText = "🛑 Dừng lại";
        startBtn.classList.add("active-stop");
        
        phaseBadge.classList.remove("hidden");
        phaseBadge.innerText = "Giai đoạn 1: Luyện Thở (2 Phút)";

        if(paceSelect) paceSelect.disabled = true;
        if(durationSelect) durationSelect.disabled = true;

        const chosenPace = parseInt(paceSelect.value) || 4;
        const totalCycleSeconds = chosenPace * 4; 

        totalTimeRemaining = parseInt(durationSelect.value);
        updateTimerDisplay(totalTimeRemaining);

        if (bgPlayer && audioSelect && audioSelect.value !== "nature") {
            bgPlayer.src = audioSelect.value;
            bgPlayer.volume = 0.8;
            bgPlayer.loop = true;
            bgPlayer.play().catch(err => console.log("Audio play blocked:", err));
        }

        // Đổi trạng thái UI báo hiệu đang chờ
        document.getElementById("breath-status").innerHTML = "<br><b>Đang lắng nghe hướng dẫn...</b>";

        // 1. Gõ chuông
        playPhaseSound(432, 2.5, 'sine');
        
        // 2. Chờ 2 giây để chuông ngân, rồi phát Voice
        setTimeout(() => {
            if (!isPracticing) return; // Nếu user lỡ bấm Dừng lúc đang đợi chuông
            
            voiceStart.currentTime = 0;
            let playPromise = voiceStart.play();

            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // 3. Audio phát thành công -> Đợi khi nào đọc xong (onended) mới chạy nhịp thở
                    voiceStart.onended = () => {
                        if (isPracticing) startBreathingEngine(chosenPace, totalCycleSeconds);
                    };
                }).catch(error => {
                    // Nếu lỗi (ví dụ chưa có file mp3), hệ thống tự động bỏ qua voice và chạy đếm nhịp luôn
                    console.log("Bỏ qua Voice, chạy thẳng đếm nhịp");
                    if (isPracticing) startBreathingEngine(chosenPace, totalCycleSeconds);
                });
            }
        }, 2000);
    }
}

// HÀM MỚI: Khởi động bộ đếm nhịp thở và đồng hồ (Chỉ chạy khi Voice đã đọc xong)
function startBreathingEngine(chosenPace, totalCycleSeconds) {
    cycleTicks = 0;
    executeFixedBreathingStep(chosenPace);

    breatheInterval = setInterval(() => {
        cycleTicks = (cycleTicks + 1) % totalCycleSeconds;
        executeFixedBreathingStep(chosenPace);
    }, 1000);

    totalTimerInterval = setInterval(() => {
        totalTimeRemaining--;
        elapsedTime++; // Tính thời gian trôi qua cho 2 phút thở hộp
        updateTimerDisplay(totalTimeRemaining);

        // Chuyển giao sang pha Thiền định
        if (elapsedTime === BREATHING_DURATION && totalTimeRemaining > 0) {
            transitionToMeditation();
        }

        // KẾT THÚC BÀI TẬP
        if (totalTimeRemaining <= 0) {
            togglePractice();
            
            playPhaseSound(528, 2.5, 'sine'); 
            setTimeout(() => { 
                voiceEnd.currentTime = 0;
                voiceEnd.play(); 
            }, 2000); 
            
            setTimeout(() => { showCompletionModal(); }, 10000);
        }
    }, 1000);
}

// HÀM: Xử lý khoảnh khắc chuyển giao và bắt đầu Giai đoạn 3
function transitionToMeditation() {
    // 1. Dừng ngay bộ đếm nhịp thở hộp
    clearInterval(breatheInterval);
    
    // 2. Phát MỘT tiếng chuông duy nhất và chờ 2 giây để phát giọng nói
    playPhaseSound(432, 2.5, 'sine');
    setTimeout(() => { voiceTransition.play(); }, 2000);
    
    // 3. Cập nhật UI sang Giai đoạn Chuyển giao -> Thiền định
    const phaseBadge = document.getElementById("phase-indicator");
    phaseBadge.innerText = "Giai đoạn 2: Thiền Định Chánh Niệm";
    
    document.getElementById("breath-status").innerHTML = "<b>Khoảnh Khắc Buông Xả...</b><br>Hãy để hơi thở diễn ra tự nhiên";
    document.getElementById("circle-text-label").innerText = "Tâm An";
    
    // 4. Đổi Vòng tròn sang trạng thái Zen
    const node = document.getElementById("breath-node");
    node.className = "breathing-circle zen-static";
    
    // 5. Ẩn thanh Pacing
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

// --- HỆ THỐNG MODAL ĐÁNH GIÁ SAU THIỀN ---
let selectedBenefits = [];

function showCompletionModal() {
    // Reset lại trạng thái các nút bấm (Bỏ chọn hết)
    selectedBenefits = [];
    document.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));
    
    // Hiển thị modal
    document.getElementById('completion-modal').classList.remove('hidden');
}

// Bắt sự kiện chọn nhiều Chip (Multiple-click)
document.getElementById('benefit-chips').addEventListener('click', (e) => {
    if(e.target.classList.contains('chip')) {
        e.target.classList.toggle('active'); // Đổi màu
        const value = e.target.getAttribute('data-value');
        
        if(e.target.classList.contains('active')) {
            selectedBenefits.push(value); // Thêm vào danh sách
        } else {
            selectedBenefits = selectedBenefits.filter(b => b !== value); // Bỏ ra khỏi danh sách
        }
    }
});

// Xử lý nút LƯU
document.getElementById('btn-save-modal').addEventListener('click', () => {
    saveMeditationSession(selectedBenefits);
    document.getElementById('completion-modal').classList.add('hidden');
    
    // Đợi modal mờ đi một chút (0.3 giây) để không bị giật cục, rồi refresh trang
    setTimeout(() => { window.location.reload(); }, 300); 
});

// Xử lý nút BỎ QUA 
document.getElementById('btn-skip-modal').addEventListener('click', () => {
    saveMeditationSession([]);
    document.getElementById('completion-modal').classList.add('hidden');
    
    // Tương tự, đợi 0.3s rồi refresh
    setTimeout(() => { window.location.reload(); }, 300);
});

// Hàm lưu trữ data vào Local Storage
function saveMeditationSession(benefits) {
    let practiceHistory = JSON.parse(localStorage.getItem('zenPracticeHistory')) || [];
    
    if (editingRecordId) {
        // TRƯỜNG HỢP 1: ĐANG EDIT RECORD CŨ
        const recordIndex = practiceHistory.findIndex(r => r.id === editingRecordId);
        if (recordIndex !== -1) {
            practiceHistory[recordIndex].benefits = benefits; // Chỉ cập nhật lại lợi ích
        }
        editingRecordId = null; // Reset lại trạng thái
    } else {
        // TRƯỜNG HỢP 2: LƯU RECORD MỚI
        const durationSelect = document.getElementById("practice-duration");
        const durationValue = durationSelect ? durationSelect.options[durationSelect.selectedIndex].text.split(' ')[0] : "0";
        
        const now = new Date();
        const record = {
            id: now.getTime(), // ID duy nhất
            isoDate: now.toISOString(), // Chuẩn DateTime để thống kê sau này
            displayDate: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} - ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`,
            duration: parseInt(durationValue),
            benefits: benefits
        };
        practiceHistory.push(record);
    }
    
    localStorage.setItem('zenPracticeHistory', JSON.stringify(practiceHistory));
    
    // Refresh lại giao diện
    renderPracticeHistory();
}

// HÀM HIỂN THỊ LỊCH SỬ THIỀN 
// Biến toàn cục để kiểm soát số lượng hiển thị
let historyDisplayLimit = 10; // Đổi thành 10 lần gần nhất

function renderPracticeHistory() {
    const container = document.getElementById('practice-history-container');
    const viewAllContainer = document.getElementById('view-all-container');
    if (!container) return;

    const history = JSON.parse(localStorage.getItem('zenPracticeHistory')) || [];
    const reversedHistory = [...history].reverse();

    if (reversedHistory.length === 0) {
        container.innerHTML = '<p style="color: #777; font-size: 14px; text-align: center; padding: 20px;">Bạn chưa có dữ liệu thực tập nào. Hãy bắt đầu bài thiền đầu tiên nhé!</p>';
        if (viewAllContainer) viewAllContainer.innerHTML = '';
        return;
    }

    // Cắt dữ liệu 10 records cho màn hình chính
    const displayHistory = reversedHistory.slice(0, historyDisplayLimit);
    container.innerHTML = generateHistoryHTML(displayHistory); // Dùng chung hàm sinh HTML

    // Xử lý nút Xem tất cả
    if (viewAllContainer) {
        if (reversedHistory.length > historyDisplayLimit) {
            viewAllContainer.innerHTML = `
                <button id="btn-view-all-history" style="background: transparent; border: 1px solid #2c4a3e; color: #2c4a3e; padding: 8px 20px; border-radius: 20px; font-size: 13px; cursor: pointer; transition: 0.2s;">
                    Xem tất cả (${reversedHistory.length})
                </button>
            `;
            
            // MỞ MODAL THAY VÌ XỔ RA GIAO DIỆN CHÍNH
            document.getElementById('btn-view-all-history').addEventListener('click', () => {
                document.getElementById('all-history-list').innerHTML = generateHistoryHTML(reversedHistory);
                document.getElementById('all-history-modal').classList.remove('hidden');
            });
        } else {
            viewAllContainer.innerHTML = ''; 
        }
    }
}

// Hàm phụ trợ sinh ra mã HTML cho thẻ lịch sử (để dùng chung cho cả ngoài web lẫn trong Modal)
function generateHistoryHTML(historyArray) {
    let htmlContent = '';
    historyArray.forEach(session => {
        let benefitsHtml = '';
        
        if (session.benefits && session.benefits.length > 0) {
            benefitsHtml = session.benefits.map(b => {
                const groupName = BENEFIT_COLOR_MAP[b] || 'empty';
                return `<span class="history-chip chip-${groupName}" style="padding: 4px 10px; border-radius: 12px; font-size: 12px; display: inline-block;">${b}</span>`;
            }).join('');
        } else {
            benefitsHtml = `<span style="color: #999; font-size: 13px; font-style: italic; display: flex; align-items: center; gap: 5px;">
                🍃 Trọn vẹn phút giây thiền tập
            </span>`;
        }

        // Tách chuỗi hiển thị thành "Giờ" và "Ngày" riêng biệt
        const rawDate = session.displayDate || session.date || "";
        let timeStr = "";
        let dateStr = rawDate;

        if (rawDate.includes(" - ")) {
            const parts = rawDate.split(" - ");
            timeStr = parts[0].trim(); // Lấy 15:15
            dateStr = parts[1].trim(); // Lấy 16/7/2026
        }

        // Cấu trúc lại UI: Ngày tháng làm Header nổi bật
        htmlContent += `
            <div class="history-card" style="background: #fff; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 12px; border: 1px solid #f2f2f2;">
                
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed #eee;">
                    
                    <div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;">
                        <strong style="color: #2c4a3e; font-size: 16px; letter-spacing: 0.3px;">
                            📅 ${dateStr}
                        </strong>
                        
                        <span style="color: #888; font-size: 13px;">
                            lúc ${timeStr} <span style="margin: 0 4px; color: #ddd;">•</span> ⏳ ${session.duration} Phút
                        </span>
                    </div>

                    <button class="btn-edit-record" data-id="${session.id}" style="background: transparent; border: none; color: #aaa; font-size: 13px; cursor: pointer; white-space: nowrap;">
                        <span style="text-decoration: underline;">Chỉnh sửa</span>
                    </button>
                </div>
                
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${benefitsHtml}
                </div>
            </div>
        `;
    });
    return htmlContent;
}

// Xử lý đóng Modal Lịch sử
document.getElementById('btn-close-history-modal').addEventListener('click', () => {
    document.getElementById('all-history-modal').classList.add('hidden');
});

// THUẬT TOÁN EXPORT RA FILE CSV DÀNH CHO EXCEL
document.getElementById('btn-export-csv').addEventListener('click', () => {
    const history = JSON.parse(localStorage.getItem('zenPracticeHistory')) || [];
    if (history.length === 0) return;

    // Chuẩn bị nội dung CSV. 
    // Dòng "\uFEFF" là ký tự BOM bắt buộc để Excel đọc được Tiếng Việt có dấu (UTF-8).
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Ngày Thực Tập,Thời Lượng (Phút),Ghi Nhận Lợi Ích\n"; // Header cột

    history.forEach(session => {
        const date = session.date;
        const duration = session.duration;
        const benefits = (session.benefits && session.benefits.length > 0) ? session.benefits.join(" | ") : "Chỉ tĩnh lặng";
        
        // Đặt nội dung vào cặp nháy kép " " để Excel không bị ngắt cột sai nếu có dấu phẩy trong văn bản
        csvContent += `"${date}","${duration}","${benefits}"\n`;
    });

    // Tạo lệnh tải file ngầm
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Nhat_Ky_Thien_Dinh.csv");
    document.body.appendChild(link);
    
    link.click(); // Kích hoạt tải về
    
    document.body.removeChild(link); // Dọn dẹp rác sau khi tải
});

// Bắt sự kiện click vào nút "Chỉnh sửa" (Dùng Event Delegation vì thẻ HTML được sinh ra động)
document.addEventListener('click', (e) => {
    // Dùng closest() để quét tìm element cha có class btn-edit-record
    const editBtn = e.target.closest('.btn-edit-record');
    
    if (editBtn) {
        // Lấy ID từ chính cái nút đó
        const recordId = parseInt(editBtn.getAttribute('data-id'));
        openEditModal(recordId);
    }
});

function openEditModal(recordId) {
    const history = JSON.parse(localStorage.getItem('zenPracticeHistory')) || [];
    const record = history.find(r => r.id === recordId);
    if (!record) return;

    // Gán ID đang edit
    editingRecordId = recordId;

    // --- THÊM DÒNG NÀY ĐỂ FIX BUG: Tự động đóng Modal All History (nếu đang mở) ---
    const historyModal = document.getElementById('all-history-modal');
    if (historyModal && !historyModal.classList.contains('hidden')) {
        historyModal.classList.add('hidden');
    }

    // 1. Mở lại Modal Kết Thúc Thiền (Sử dụng lại UI cũ cho đồng bộ)
    const modal = document.getElementById('completion-modal');
    
    // Đổi tiêu đề để user biết đang ở chế độ Edit
    modal.querySelector('.modal-title').innerText = "✏️ Cập nhật ghi nhận";
    modal.querySelector('.modal-desc').innerText = `Lần tập: ${record.displayDate || record.date} (${record.duration} phút)\nBạn muốn bổ sung thêm điều gì?`;

    // 2. Xóa các lựa chọn cũ trên Modal
    document.querySelectorAll('#benefit-chips .chip').forEach(chip => {
        chip.classList.remove('active');
        // 3. Đánh dấu (Active) những lợi ích mà record này đã có
        const chipValue = chip.getAttribute('data-value');
        if (record.benefits && record.benefits.includes(chipValue)) {
            chip.classList.add('active');
            selectedBenefits.push(chipValue); // Push vào mảng tạm để lúc Save sẽ lưu
        }
    });

    selectedBenefits = record.benefits ? [...record.benefits] : []; // Khởi tạo mảng selected

    // 4. Hiển thị Modal
    modal.classList.remove('hidden');
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
