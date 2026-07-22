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
    renderPracticeHistory();
    renderBenefitChipsUI(); // Vẽ UI cho các nút chọn giá trị đạt được sau khi thiền
    renderDashboard(); // Gọi hàm tính toán Dashboard
    renderSurveyHistory();

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
        renderGuidedTrackOptions();
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
// === LOGIC CHUYỂN ĐỔI CHẾ ĐỘ THIỀN (TĨNH LẶNG <-> HƯỚNG DẪN) ===
document.addEventListener("DOMContentLoaded", () => {
    const modeSilentBtn = document.getElementById('mode-silent');
    const modeGuidedBtn = document.getElementById('mode-guided');
    const settingsSilent = document.getElementById('settings-silent');
    const settingsGuided = document.getElementById('settings-guided');
    const pacingBars = document.getElementById("pacing-bars-container");
    const audioHint = document.getElementById("audio-hint");
    const circleText = document.getElementById("circle-text-label");

    if (modeSilentBtn && modeGuidedBtn) {
        // --- KHI CHỌN THIỀN TĨNH LẶNG ---
        modeSilentBtn.addEventListener('click', () => {
            if (isPracticing) return; // Khóa không cho đổi khi đang thiền

            modeSilentBtn.classList.add('active');
            modeSilentBtn.style.background = '#fff';
            modeSilentBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            modeSilentBtn.style.color = '#2c4a3e';

            modeGuidedBtn.classList.remove('active');
            modeGuidedBtn.style.background = 'transparent';
            modeGuidedBtn.style.boxShadow = 'none';
            modeGuidedBtn.style.color = '#888';

            settingsSilent.style.display = 'block';
            settingsGuided.style.display = 'none';

            // PHỤC HỒI UI BÊN PHẢI
            if (pacingBars) pacingBars.style.display = "grid"; // Hiện lại thanh thở
            if (audioHint) audioHint.style.display = "block"; // Hiện lại lưu ý
            if (circleText) circleText.innerText = "Hơi thở";

            // Lấy lại số phút của thẻ chọn Thời lượng để đắp lên đồng hồ
            const durationSelect = document.getElementById("practice-duration");
            if (durationSelect) updateTimerDisplay(parseInt(durationSelect.value));
        });

        // --- KHI CHỌN THIỀN CHỈ DẪN ---
        modeGuidedBtn.addEventListener('click', () => {
            if (isPracticing) return; // Khóa không cho đổi khi đang thiền

            modeGuidedBtn.classList.add('active');
            modeGuidedBtn.style.background = '#fff';
            modeGuidedBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            modeGuidedBtn.style.color = '#2c4a3e';

            modeSilentBtn.classList.remove('active');
            modeSilentBtn.style.background = 'transparent';
            modeSilentBtn.style.boxShadow = 'none';
            modeSilentBtn.style.color = '#888';

            settingsGuided.style.display = 'block';
            settingsSilent.style.display = 'none';

            // DỌN DẸP UI BÊN PHẢI (CHUẨN BỊ CHO THIỀN CHỈ DẪN)
            if (pacingBars) pacingBars.style.display = "none"; // Ẩn hoàn toàn thanh thở
            if (audioHint) audioHint.style.display = "none"; // Ẩn lưu ý
            if (circleText) circleText.innerText = "Tâm An";

            // Lấy số phút của bài MP3 đang chọn đắp lên đồng hồ
            const trackSelect = document.getElementById("guided-track-select");
            if (siteData && siteData.guided_meditations && trackSelect) {
                const track = siteData.guided_meditations[trackSelect.value];
                if (track) updateTimerDisplay(track.durationMinutes * 60);
            }
        });
    }
});

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Hàm tạo danh sách <option> cho thẻ Select
function renderGuidedTrackOptions() {
    if (!siteData || !siteData.guided_meditations) return;
    
    const select = document.getElementById("guided-track-select");
    if (!select) return;
    
    let html = "";
    siteData.guided_meditations.forEach((track, index) => {
        // Nới rộng giới hạn ký tự vì đã bỏ phần tên tác giả
        const MAX_LENGTH = 45; 
        let shortTitle = track.title;
        if (shortTitle.length > MAX_LENGTH) {
            shortTitle = shortTitle.substring(0, MAX_LENGTH).trim() + "...";
        }

        // Cập nhật format mới: Chỉ hiện <Title> (<Duration>)
        html += `<option value="${index}">${shortTitle} - ${track.durationMinutes} phút</option>`;
    });
    select.innerHTML = html;
    
    // Khởi tạo hiển thị thông tin cho bài đầu tiên
    updateGuidedTrackInfo(0);
    
    // Lắng nghe mỗi khi user chọn bài khác thì đổi thông tin bên dưới
    select.addEventListener("change", (e) => {
        updateGuidedTrackInfo(e.target.value);
    });
}

// Hàm cập nhật chữ trong khối thông tin Bài thiền
function updateGuidedTrackInfo(index) {
    if (!siteData || !siteData.guided_meditations) return;
    const track = siteData.guided_meditations[index];
    if (!track) return;
    
    document.getElementById("guided-info-title").innerText = track.title;
    document.getElementById("guided-info-author").innerText = `🎙️ Hướng dẫn: ${track.author}`;
    document.getElementById("guided-info-duration").innerText = `⏳ Thời lượng: ${track.durationMinutes} phút`;
    document.getElementById("guided-info-desc").innerText = track.desc;

    // Kích hoạt đổi số phút trên mặt đồng hồ lớn
    const modeGuidedBtn = document.getElementById('mode-guided');
    // Chỉ nhảy đồng hồ nếu chưa bấm Bắt đầu VÀ đang đứng ở chế độ Thiền Chỉ Dẫn
    if (!isPracticing && modeGuidedBtn && modeGuidedBtn.classList.contains('active')) {
        updateTimerDisplay(track.durationMinutes * 60);
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
let actualCompletedMinutes = 0; // THÊM DÒNG NÀY: Lưu số phút thực tế đã hoàn thành
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
    const trackSelect = document.getElementById("guided-track-select");

    // KIỂM TRA XEM NGƯỜI DÙNG ĐANG Ở TAB NÀO
    const modeGuidedBtn = document.getElementById('mode-guided');
    const isGuidedMode = modeGuidedBtn && modeGuidedBtn.classList.contains('active');

    if (isPracticing) {
        // ==========================================
        // CƠ CHẾ DỪNG THIỀN (DÙNG CHUNG CHO CẢ 2 CHẾ ĐỘ)
        // ==========================================
        clearInterval(breatheInterval);
        clearInterval(totalTimerInterval);
        isPracticing = false;

        // --- BƯỚC 4: TÍNH TOÁN THỜI GIAN THỰC TẾ ---
        actualCompletedMinutes = Math.floor(elapsedTime / 60);
        const isFinishedNaturally = (totalTimeRemaining <= 0);

        voiceStart.pause(); voiceStart.currentTime = 0;
        voiceTransition.pause(); voiceTransition.currentTime = 0;
        voiceEnd.pause(); voiceEnd.currentTime = 0;

        startBtn.innerText = "🧘 Bắt Đầu Thiền";
        startBtn.classList.remove("active-stop");

        resetBreathingVisuals();

        // Khôi phục lại mặt đồng hồ tùy theo chế độ
        if (isGuidedMode && trackSelect && siteData) {
            const track = siteData.guided_meditations[trackSelect.value];
            updateTimerDisplay(track.durationMinutes * 60);
        } else {
            updateTimerDisplay(parseInt(durationSelect.value));
        }

        phaseBadge.classList.add("hidden");
        pacingBars.classList.remove("fade-out");
        audioHint.classList.remove("fade-out");
        document.getElementById("circle-text-label").innerText = "Hơi thở";

        // Mở khóa lại các nút chọn
        if(paceSelect) paceSelect.disabled = false;
        if(durationSelect) durationSelect.disabled = false;
        if(trackSelect) trackSelect.disabled = false;

        if (bgPlayer) {
            bgPlayer.pause();
            bgPlayer.currentTime = 0;
        }

        // --- BƯỚC 4: KÍCH HOẠT MODAL NẾU DỪNG SỚM (> 2 PHÚT) ---
        if (!isFinishedNaturally && elapsedTime >= 120) {
            // Đợi 0.5s cho UI kịp dọn dẹp rồi mới hiện bảng chúc mừng
            setTimeout(() => { showCompletionModal(); }, 500);
        }
    } else {
        // ==========================================
        // CƠ CHẾ BẮT ĐẦU
        // ==========================================
        isPracticing = true;
        elapsedTime = 0;

        startBtn.innerText = "🛑 Dừng lại";
        startBtn.classList.add("active-stop");

        // Khóa các nút chọn để không bị lỗi click nhầm lúc đang thiền
        if(paceSelect) paceSelect.disabled = true;
        if(durationSelect) durationSelect.disabled = true;
        if(trackSelect) trackSelect.disabled = true;

        // PHÂN LUỒNG LOGIC: TĨNH LẶNG HAY HƯỚNG DẪN?
        if (isGuidedMode && trackSelect && siteData) {
            // --- NGÃ RẼ 1: THIỀN THEO HƯỚNG DẪN (GUIDED) ---
            const track = siteData.guided_meditations[trackSelect.value];
            totalTimeRemaining = track.durationMinutes * 60;
            updateTimerDisplay(totalTimeRemaining);

            phaseBadge.classList.remove("hidden");
            phaseBadge.innerText = `🎧 Đang phát: ${track.title}`;

            document.getElementById("breath-status").innerHTML = "<br><b>Hãy nhắm mắt và thả lỏng...</b>";
            document.getElementById("circle-text-label").innerText = "Tâm An";

            // Chuyển hình tròn sang trạng thái mờ dịu
            const node = document.getElementById("breath-node");
            node.className = "breathing-circle zen-static";

            // Ẩn thanh nhịp thở và câu nhắc nhở
            pacingBars.classList.add("fade-out");
            audioHint.classList.add("fade-out");

            // Nạp file MP3 và phát
            if (bgPlayer) {
                bgPlayer.src = track.src;
                bgPlayer.volume = 1.0;
                bgPlayer.loop = false; // Phát 1 lần, không lặp lại
                bgPlayer.play().catch(err => console.log("Audio play blocked:", err));
            }

            // Chạy đồng hồ đếm ngược trực tiếp
            totalTimerInterval = setInterval(() => {
                totalTimeRemaining--;
                elapsedTime++; // Biến này sẽ dùng cho Bước 4 (chốt thời gian thực tế)
                updateTimerDisplay(totalTimeRemaining);

                if (totalTimeRemaining <= 0) {
                    togglePractice();
                    playPhaseSound(528, 2.5, 'sine'); // Báo chuông kết thúc nhẹ nhàng
                    setTimeout(() => { showCompletionModal(); }, 3000);
                }
            }, 1000);

        } else {
            // --- NGÃ RẼ 2: THIỀN TĨNH LẶNG (SILENT - CODE CŨ CỦA ANH) ---
            const chosenPace = parseInt(paceSelect.value) || 4;
            const totalCycleSeconds = chosenPace * 4;

            totalTimeRemaining = parseInt(durationSelect.value);
            updateTimerDisplay(totalTimeRemaining);

            phaseBadge.classList.remove("hidden");
            phaseBadge.innerText = "Giai đoạn 1: Luyện Thở (2 Phút)";

            if (bgPlayer && audioSelect && audioSelect.value !== "nature") {
                bgPlayer.src = audioSelect.value;
                bgPlayer.volume = 0.8;
                bgPlayer.loop = true;
                bgPlayer.play().catch(err => console.log("Audio play blocked:", err));
            }

            document.getElementById("breath-status").innerHTML = "<br><b>Đang lắng nghe hướng dẫn...</b>";

            playPhaseSound(432, 2.5, 'sine');
            setTimeout(() => {
                if (!isPracticing) return;

                voiceStart.currentTime = 0;
                let playPromise = voiceStart.play();

                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        voiceStart.onended = () => {
                            if (isPracticing) startBreathingEngine(chosenPace, totalCycleSeconds);
                        };
                    }).catch(error => {
                        console.log("Bỏ qua Voice, chạy thẳng đếm nhịp");
                        if (isPracticing) startBreathingEngine(chosenPace, totalCycleSeconds);
                    });
                }
            }, 2000);
        }
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

// HÀM: Xử lý khoảnh khắc chuyển giao và bắt đầu Giai đoạn 2
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
    document.body.classList.add('no-scroll'); document.documentElement.classList.add('no-scroll');
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

// ==========================================
// AUTO-SAVE: LƯU NGẦM KHI USER TẮT TRANG ĐỘT NGỘT
// ==========================================
// ==========================================
// AUTO-SAVE: LƯU NGẦM KHI USER TẮT TRANG ĐỘT NGỘT
// ==========================================
window.addEventListener('beforeunload', (event) => {
    if (isPracticing && elapsedTime >= 120) {
        let practiceHistory = JSON.parse(localStorage.getItem('zenPracticeHistory')) || [];
        
        let autoCompletedMinutes = Math.floor(elapsedTime / 60);
        let finalDuration = (autoCompletedMinutes >= 2) ? autoCompletedMinutes : 2;
        
        // --- LẤY TÊN BÀI THIỀN ---
        let currentTrackTitle = "Thiền Tĩnh Lặng";
        const modeGuidedBtn = document.getElementById('mode-guided');
        if (modeGuidedBtn && modeGuidedBtn.classList.contains('active')) {
            const trackSelect = document.getElementById("guided-track-select");
            if (siteData && siteData.guided_meditations && trackSelect) {
                const track = siteData.guided_meditations[trackSelect.value];
                if (track) currentTrackTitle = track.title;
            }
        }
        
        const now = new Date();
        const record = {
            id: now.getTime(), 
            isoDate: now.toISOString(), 
            displayDate: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} - ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`,
            duration: finalDuration,
            trackTitle: currentTrackTitle, // THÊM DÒNG NÀY: Lưu tên bài
            benefits: ["Kết thúc sớm (hệ thống lưu tự động)"] 
        };
        
        practiceHistory.push(record);
        localStorage.setItem('zenPracticeHistory', JSON.stringify(practiceHistory));
    }
});

// Hàm lưu trữ data vào Local Storage
// Hàm lưu trữ data vào Local Storage
function saveMeditationSession(benefits) {
    let practiceHistory = JSON.parse(localStorage.getItem('zenPracticeHistory')) || [];
    
    // --- LẤY TÊN BÀI THIỀN ---
    let currentTrackTitle = "Thiền Tĩnh Lặng";
    const modeGuidedBtn = document.getElementById('mode-guided');
    if (modeGuidedBtn && modeGuidedBtn.classList.contains('active')) {
        const trackSelect = document.getElementById("guided-track-select");
        if (siteData && siteData.guided_meditations && trackSelect) {
            const track = siteData.guided_meditations[trackSelect.value];
            if (track) currentTrackTitle = track.title;
        }
    }
    
    if (editingRecordId) {
        // TRƯỜNG HỢP 1: ĐANG EDIT RECORD CŨ
        const recordIndex = practiceHistory.findIndex(r => r.id === editingRecordId);
        if (recordIndex !== -1) {
            practiceHistory[recordIndex].benefits = benefits; 
        }
        editingRecordId = null; 
    } else {
        // TRƯỜNG HỢP 2: LƯU RECORD MỚI 
        const now = new Date();
        let finalDuration = (actualCompletedMinutes >= 2) ? actualCompletedMinutes : 2;
        
        const record = {
            id: now.getTime(), 
            isoDate: now.toISOString(), 
            displayDate: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} - ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`,
            duration: finalDuration,
            trackTitle: currentTrackTitle, // THÊM DÒNG NÀY: Lưu tên bài
            benefits: benefits
        };
        practiceHistory.push(record);
    }
    
    localStorage.setItem('zenPracticeHistory', JSON.stringify(practiceHistory));
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
                document.body.classList.add('no-scroll'); document.documentElement.classList.add('no-scroll');
            });
        } else {
            viewAllContainer.innerHTML = ''; 
        }
    }
}

// Hàm phụ trợ sinh ra mã HTML cho thẻ lịch sử (để dùng chung cho cả ngoài web lẫn trong Modal)
// Hàm phụ trợ sinh ra mã HTML cho thẻ lịch sử
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
                Chưa ghi nhận tác dụng bài thiền.
            </span>`;
        }

        const rawDate = session.displayDate || session.date || "";
        let timeStr = "";
        let dateStr = rawDate;

        if (rawDate.includes(" - ")) {
            const parts = rawDate.split(" - ");
            timeStr = parts[0].trim(); 
            dateStr = parts[1].trim(); 
        }

        // --- XỬ LÝ HIỂN THỊ TÊN BÀI THIỀN ---
        // Đảm bảo tương thích ngược: Nếu dữ liệu cũ không có trackTitle thì bỏ qua
        let titleHtml = "";
        if (session.trackTitle) {
            titleHtml = `<span style="margin: 0 4px; color: #ddd;">•</span> <span style="color: #5a7365; font-weight: 600;">${session.trackTitle}</span>`;
        }

        htmlContent += `
            <div class="history-list-item" style="padding: 16px 0; border-bottom: 1px solid #f0f0f0;">
                
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
                    
                    <div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;">
                        <strong style="color: #2c4a3e; font-size: 16px; letter-spacing: 0.3px;">
                            📅 ${dateStr}
                        </strong>
                        <span style="color: #888; font-size: 13px;">
                            lúc ${timeStr} <span style="margin: 0 4px; color: #ddd;">•</span> ⏳ ${session.duration} Phút ${titleHtml}
                        </span>
                    </div>

                    <button class="btn-edit-record" data-id="${session.id}" style="background: transparent; border: none; color: #aaa; font-size: 13px; cursor: pointer; white-space: nowrap;">
                        <span style="text-decoration: underline;">✏️</span>
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
    document.body.classList.remove('no-scroll'); document.documentElement.classList.remove('no-scroll');
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
    document.body.classList.add('no-scroll'); document.documentElement.classList.add('no-scroll');
}

// Hàm tự động tạo mã ảnh SVG cho các Huy hiệu
// Hàm tự động tạo mã ảnh SVG cho các Huy hiệu theo từng mốc tiến hóa
function generateBadgeSVG(milestone) {
    let colorStart, colorEnd, textSize, textLabel, bgShape, textY;

    // Path chuẩn của 1 ngôi sao 5 cánh (Dùng chung để dễ quản lý)
    const starPath = "M0 -6 L1.5 -1.5 L6 -1.5 L2.5 1 L4 6 L0 3.5 L-4 6 L-2.5 1 L-6 -1.5 L-1.5 -1.5 Z";

    if (milestone === 0) {
        // CẤP 0: HẠT GIỐNG (Giữ nguyên hình hạt mầm mộc mạc)
        colorStart = "#d4ccb8"; colorEnd = "#8c7662";
        textLabel = "SEED"; textSize = "14"; textY = "34.5"; // Chữ nằm chính giữa
        bgShape = `<path d="M32 20 C 40 30 42 42 32 48 C 22 42 24 30 32 20 Z" fill="#ffffff" opacity="0.4"/>`;
        
    } else if (milestone <= 5) {
        // CẤP 1 (1h, 2h, 5h): 1 SAO TO (Nổi bật)
        colorStart = "#a8e6cf"; colorEnd = "#3b7b54";
        textLabel = milestone + "h"; textSize = "18"; textY = "38"; // Chữ hạ thấp xuống để nhường chỗ cho sao
        bgShape = `<g transform="translate(32, 16) scale(1.3)"><path d="${starPath}" fill="#ffffff" opacity="0.8"/></g>`;
        
    } else if (milestone <= 50) {
        // CẤP 2 (10h, 20h, 50h): 2 SAO CÂN XỨNG
        colorStart = "#89cff0"; colorEnd = "#2980b9";
        textLabel = milestone + "h"; textSize = "18"; textY = "38";
        bgShape = `
            <g fill="#ffffff" opacity="0.8">
                <g transform="translate(22, 16) scale(1.1)"><path d="${starPath}"/></g>
                <g transform="translate(42, 16) scale(1.1)"><path d="${starPath}"/></g>
            </g>`;
            
    } else if (milestone <= 500) {
        // CẤP 3 (100h, 200h, 500h): 3 SAO (Đội hình vương miện)
        colorStart = "#f6d365"; colorEnd = "#fda085";
        textLabel = milestone + "h"; textSize = "18"; textY = "38";
        bgShape = `
            <g fill="#ffffff" opacity="0.8">
                <g transform="translate(32, 11) scale(1.1)"><path d="${starPath}"/></g>
                <g transform="translate(18, 17) scale(0.9)"><path d="${starPath}"/></g>
                <g transform="translate(46, 17) scale(0.9)"><path d="${starPath}"/></g>
            </g>`;
            
    } else {
        // CẤP 4 (1000h+): KHAI SÁNG TÂM TRÍ (Họa tiết Vũ trụ siêu cấp)
        colorStart = "#8E54E9"; colorEnd = "#4776E6";
        textLabel = milestone + "h"; textSize = "14"; textY = "34.5"; // Chữ về lại chính giữa
        bgShape = `
            <g opacity="0.6">
                <path d="M32 4 L36 24 L56 28 L38 36 L44 56 L32 42 L20 56 L26 36 L8 28 L28 24 Z" fill="#ffffff"/>
                <circle cx="32" cy="32" r="16" fill="none" stroke="#ffffff" stroke-width="1.5"/>
                <circle cx="32" cy="32" r="22" fill="none" stroke="#ffffff" stroke-width="1" stroke-dasharray="2 3"/>
            </g>`;
    }

    return `
    <svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad${milestone}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${colorStart}" />
                <stop offset="100%" stop-color="${colorEnd}" />
            </linearGradient>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.15"/>
            </filter>
        </defs>
        
        <circle cx="32" cy="32" r="30" fill="url(#grad${milestone})" filter="url(#shadow)"/>
        
        <!-- Họa tiết (thay đổi theo cấp độ) -->
        ${bgShape}
        
        <text x="32" y="${textY}" font-family="system-ui, sans-serif" font-size="${textSize}" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${textLabel}</text>
    </svg>`;
}

function renderDashboard() {
    const history = JSON.parse(localStorage.getItem('zenPracticeHistory')) || [];
    if (history.length === 0) return;

    let totalMinutes = 0;
    let currentMonthDays = new Set();
    let weekStarts = new Set(); 
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // 1. Lọc data cơ bản
    function getMonday(d) {
        let date = new Date(d);
        let day = date.getDay();
        let diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff)).setHours(0,0,0,0);
    }

    history.forEach(record => {
        totalMinutes += parseInt(record.duration) || 0;
        const dateObj = new Date(record.isoDate || record.timestamp);

        if (dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) {
            currentMonthDays.add(dateObj.getDate());
        }
        weekStarts.add(getMonday(dateObj));
    });

    // =====================================
    // BOX 1: TỔNG GIỜ & HUY HIỆU (ENGLISH SVG)
    // =====================================
    const totalHours = totalMinutes / 60;
    const MILESTONES = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    
    let currentMilestone = 0;
    let nextMilestone = 1;
    
    for (let i = 0; i < MILESTONES.length; i++) {
        if (totalHours >= MILESTONES[i]) {
            currentMilestone = MILESTONES[i];
            nextMilestone = MILESTONES[i+1] || MILESTONES[i]; 
        } else {
            break;
        }
    }
    // === CHÈN TẠM DÒNG NÀY ĐỂ TEST UI (Xóa đi khi test xong) ===
    //currentMilestone = 5000; // Thử đổi số này thành 1, 5, 20, 100 để xem các màu
    // ============================================================
    let progressPercent = (totalHours / nextMilestone) * 100;
    if (progressPercent > 100) progressPercent = 100;

    // Render Box 1 (Đổ mã SVG vào thẻ thay vì ghi Text)
    document.getElementById('dash-total-val').innerText = totalMinutes; 
    document.getElementById('dash-current-badge').innerHTML = generateBadgeSVG(currentMilestone);
    
    document.getElementById('dash-progress-fill').style.width = progressPercent + "%";
    document.getElementById('dash-prog-start').innerText = (totalHours).toFixed(1) + "h";
    document.getElementById('dash-prog-end').innerText = nextMilestone + "h";
    // Cập nhật sự kiện click để truyền đúng tên Huy hiệu Thời gian hiện tại
    const currentBadgeObj = BADGE_CATALOG.find(b => b.id === currentMilestone) || BADGE_CATALOG[0];
    document.getElementById('dash-current-badge').setAttribute('onclick', `openCategoryModal('time', '${currentBadgeObj.name}')`);
    // =====================================
    // BOX 2: MẠCH DUY TRÌ (WEEKLY STREAKS)
    // =====================================
    let sortedWeeks = Array.from(weekStarts).sort((a, b) => b - a); // Từ mới -> cũ
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempLongest = 0;

    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    const thisMonday = getMonday(new Date());
    const lastMonday = thisMonday - ONE_WEEK;

    if (sortedWeeks.length > 0) {
        // --- Tính Current Streak ---
        if (sortedWeeks[0] === thisMonday || sortedWeeks[0] === lastMonday) {
            currentStreak = 1;
            let checkMonday = sortedWeeks[0];
            for (let i = 1; i < sortedWeeks.length; i++) {
                if (checkMonday - sortedWeeks[i] === ONE_WEEK) {
                    currentStreak++;
                    checkMonday = sortedWeeks[i];
                } else {
                    break;
                }
            }
        }

        // --- Tính Longest Streak ---
        tempLongest = 1;
        longestStreak = 1;
        for (let i = 0; i < sortedWeeks.length - 1; i++) {
            if (sortedWeeks[i] - sortedWeeks[i+1] === ONE_WEEK) {
                tempLongest++;
                if (tempLongest > longestStreak) longestStreak = tempLongest;
            } else {
                tempLongest = 1; // Reset nếu đứt mạch
            }
        }
    }

    // Render BOX 2
    document.getElementById('dash-current-streak').innerText = currentStreak;
    document.getElementById('dash-longest-streak').innerText = longestStreak;
    
    // --- THUẬT TOÁN LOGIC TÌM BADGE CHUẨN ---
    let targetStreakBadge = STREAK_CATALOG[0]; // Mặc định hiển thị mốc thấp nhất (10w)
    let isStreakUnlocked = false;

    // Tìm huy hiệu cao nhất MÀ NGƯỜI DÙNG ĐÃ ĐẠT ĐƯỢC
    let achievedStreakBadge = null;
    for (let i = 0; i < STREAK_CATALOG.length; i++) {
        if (longestStreak >= STREAK_CATALOG[i].id) {
            achievedStreakBadge = STREAK_CATALOG[i];
        }
    }

    if (achievedStreakBadge) {
        // Đã đạt được ít nhất 1 mốc -> Show mốc cao nhất đã đạt
        targetStreakBadge = achievedStreakBadge;
        isStreakUnlocked = true;
    } else {
        // Chưa đạt mốc nào (VD: 2w) -> Show mốc 10w nhưng ở trạng thái KHÓA XÁM
        targetStreakBadge = STREAK_CATALOG[0];
        isStreakUnlocked = false;
    }

    // Đổ SVG vào HTML
    const streakBadgeContainer = document.getElementById('dash-streak-badge');
    streakBadgeContainer.innerHTML = generateStreakSVG(targetStreakBadge.id);
    
    // Áp dụng bộ lọc xám nếu chưa mở khóa
    if (!isStreakUnlocked) {
        streakBadgeContainer.classList.add('trophy-locked');
    } else {
        streakBadgeContainer.classList.remove('trophy-locked');
    }
    
    // Gán sự kiện click để focus đúng vào badge đang hiển thị
    streakBadgeContainer.setAttribute('onclick', `openCategoryModal('streak', '${targetStreakBadge.name}')`);

    // Khởi tạo Lưới Lịch Tích Lũy
    initMonthlyCalendar(history);

    // =====================================
    // BOX 4: KHUNG GIỜ QUEN THUỘC (TIME DISTRIBUTION)
    // =====================================
    let hourlyCounts = new Array(24).fill(0);
    
    history.forEach(record => {
        const dateObj = new Date(record.isoDate || record.timestamp);
        const hour = dateObj.getHours(); 
        hourlyCounts[hour]++;
    });

    // 1. Tìm Max để tính chiều cao tỷ lệ % cho cột biểu đồ
    const maxCount = Math.max(...hourlyCounts, 1); 

    // 2. Tìm Top 3 khung giờ có số lần tập cao nhất
    let topHoursList = [];
    for (let i = 0; i < 24; i++) {
        if (hourlyCounts[i] > 0) {
            topHoursList.push({ hour: i, count: hourlyCounts[i] });
        }
    }
    topHoursList.sort((a, b) => b.count - a.count);
    
    // Lấy mảng giờ (để check tô màu) và mảng Object (để in text)
    let top3Hours = topHoursList.slice(0, 3).map(item => item.hour);
    let top3Data = topHoursList.slice(0, 3);

    // 3. Hiển thị text Top 3 kèm theo số lần (metric rõ ràng)
    const topHoursText = top3Data.length > 0 
        ? top3Data.map(item => 
            // white-space: nowrap giúp giữ thời gian và số lần không bao giờ bị rớt dòng tách rời nhau
            `<span style="white-space: nowrap;">${String(item.hour).padStart(2, '0')}:00 <span style="color:#e67e22; font-size: 0.9em;">(${item.count} lần)</span></span>`
          ).join(' <span style="color:#ddd; margin: 0 6px;">•</span> ')
        : "--:--";
    document.getElementById('dash-top-hours').innerHTML = topHoursText;

    // 4. Vẽ 24 cột biểu đồ
    let chartHtml = '';
    for (let i = 0; i < 24; i++) {
        const count = hourlyCounts[i];
        const heightPercent = (count / maxCount) * 100;
        const isTopHour = top3Hours.includes(i) ? 'top-hour' : '';
        const timeLabel = `${String(i).padStart(2, '0')}:00`;
        
        // Nếu số lần = 0: Ẩn hoàn toàn cột (chiều cao = 0, background trong suốt)
        // Nếu số lần > 0: Hiện con số nhỏ ở trên đỉnh và tính chiều cao tối thiểu để dễ bấm
        const countDisplay = count > 0 ? `<div style="font-size: 9px; color: #888; font-weight: 700; margin-bottom: 2px;">${count}</div>` : '';
        const barStyle = count > 0 ? `height: ${Math.max(heightPercent, 5)}%; min-height: 4px;` : `height: 0px; min-height: 0px; background: transparent;`;
        
        chartHtml += `
            <div class="chart-bar-wrapper" style="align-items: center;">
                <div class="chart-tooltip">${timeLabel} - ${count} lần</div>
                ${countDisplay}
                <div class="chart-bar ${isTopHour}" style="${barStyle}"></div>
            </div>
        `;
    }
    document.getElementById('hourly-chart-container').innerHTML = chartHtml;
    // =====================================
    // BOX 5: THÀNH QUẢ THIỀN TẬP (BENEFITS PEBBLES)
    // =====================================
    // 1. Thống kê số lần đạt được từng Benefit
    let benefitCounts = {};
    history.forEach(record => {
        if (record.benefits && Array.isArray(record.benefits)) {
            record.benefits.forEach(b => {
                benefitCounts[b] = (benefitCounts[b] || 0) + 1;
            });
        }
    });

    // 2. Lọc ra danh sách các Thành quả ĐÃ ĐẠT ĐƯỢC (count > 0) để show lên Dashboard
    let achievedBenefitsHtml = '';
    let achievedCount = 0;

    BENEFITS_CONFIG.forEach(category => {
        category.items.forEach(item => {
            const count = benefitCounts[item.value] || 0;
            if (count > 0) { // Chỉ show những cái đã từng đạt ít nhất 1 lần
                achievedCount++;
                
                // LOGIC MỚI: Chỉ mở khóa (hết xám) khi đạt 100 lần
                const isUnlocked = count >= 100; 
                const lockedClass = isUnlocked ? '' : 'trophy-locked';
                
                const emoji = item.label.split(' ')[0]; 
                const svgPebble = generateBenefitSVG(item.groupClass, emoji);
                
                achievedBenefitsHtml += `
                    <div style="display: flex; flex-direction: column; align-items: center; width: 64px; flex-shrink: 0; cursor: pointer;" 
                    onclick="openCategoryModal('benefit', '${item.value}')" 
                    title="${item.value}">
                        <div class="${lockedClass}" style="width: 56px; height: 56px; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                            ${svgPebble}
                        </div>
                        <div style="font-size: 11px; font-weight: 700; color: #2c4a3e; margin-top: 4px; background: #eae3d5; padding: 2px 8px; border-radius: 10px; white-space: nowrap;">
                            ${count}/100
                        </div>
                    </div>
                `;
            }
        });
    });

    // 3. Render ra UI
    const benefitRow = document.getElementById('benefit-badges-row');
    if (achievedCount > 0) {
        benefitRow.innerHTML = achievedBenefitsHtml;
    } else {
        benefitRow.innerHTML = `<div style="font-size: 13px; color: #888; font-style: italic; width: 100%; text-align: center; padding: 10px 0;">Hành trình bắt đầu từ những tĩnh lặng đầu tiên. Hãy thực hành thiền để gieo hạt giống.</div>`;
    }
}

// ==========================================
// TÍNH NĂNG VẼ LỊCH TÍCH LŨY (MINI CALENDAR)
// ==========================================
function initMonthlyCalendar(history) {
    const filter = document.getElementById('dash-month-filter');
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Gán giá trị mặc định là tháng hiện tại (Format bắt buộc của thẻ là YYYY-MM)
    const formattedMonth = String(currentMonth + 1).padStart(2, '0');
    filter.value = `${currentYear}-${formattedMonth}`;
    
    // Vẽ lịch tháng hiện tại ở lần tải đầu tiên
    renderMiniCalendar(currentMonth, currentYear, history);

    // Lắng nghe sự kiện khi người dùng tự do chọn tháng/năm bất kỳ
    filter.addEventListener('change', (e) => {
        if (!e.target.value) return; // Đề phòng user nhấn nút Clear xóa trắng dữ liệu
        
        // Dữ liệu trả về luôn có dạng "YYYY-MM" (VD: "2026-07")
        const [y, m] = e.target.value.split('-').map(Number);
        
        // Truyền vào hàm render (trừ m đi 1 vì Date Object đếm tháng từ 0 - 11)
        renderMiniCalendar(m - 1, y, history);
    });
}

function renderMiniCalendar(month, year, history) {
    const wrapper = document.getElementById('calendar-wrapper');
    const activeDays = new Set();
    
    let monthMins = 0;
    let monthSessions = 0;
    
    // Đếm số ngày có tập và tính tổng thời gian trong tháng được chọn
    history.forEach(record => {
        const d = new Date(record.isoDate || record.timestamp);
        if (d.getMonth() === month && d.getFullYear() === year) {
            activeDays.add(d.getDate());
            monthMins += parseInt(record.duration) || 0;
            monthSessions++;
        }
    });

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const displayMonth = String(month + 1).padStart(2, '0');
    let label = (month === currentMonth && year === currentYear) ? "THÁNG NÀY" : `THÁNG ${displayMonth}/${year}`;
    
    // Cập nhật các con số lên màn hình
    document.getElementById('dash-month-label').innerText = label;
    document.getElementById('dash-month-days').innerText = activeDays.size;
    
    // Cập nhật Thanh Tóm Tắt Tháng
    document.getElementById('summary-month-mins').innerText = monthMins;
    document.getElementById('summary-month-sessions').innerText = monthSessions;
    let avg = monthSessions > 0 ? Math.round(monthMins / monthSessions) : 0;
    document.getElementById('summary-month-avg').innerText = avg;

    // Tính toán mốc ngày để vẽ khung lịch
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); 
    const startOffset = firstDay === 0 ? 6 : firstDay - 1; 

    let html = `<div class="calendar-container">
        <div class="calendar-header">
            <div class="cal-day-name">Mon</div>
            <div class="cal-day-name">Tue</div>
            <div class="cal-day-name">Wed</div>
            <div class="cal-day-name">Thu</div>
            <div class="cal-day-name">Fri</div>
            <div class="cal-day-name">Sat</div>
            <div class="cal-day-name">Sun</div>
        </div>
        <div class="calendar-grid">`;
        
    for (let i = 0; i < startOffset; i++) {
        html += `<div class="cal-slot empty-slot"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        if (activeDays.has(day)) {
            html += `<div class="cal-slot active-day">${day}</div>`;
        } else {
            html += `<div class="cal-slot">${day}</div>`;
        }
    }

    html += `</div></div>`;
    wrapper.innerHTML = html;
}

// === LOGIC CHUYỂN TAB (THỐNG KÊ <-> LỊCH SỬ) ===
const tabStats = document.getElementById('tab-stats');
const tabHistory = document.getElementById('tab-history');
const contentStats = document.getElementById('content-stats');
const contentHistory = document.getElementById('content-history');

if (tabStats && tabHistory) {
    tabStats.addEventListener('click', () => {
        // Đổi màu nút
        tabStats.style.background = '#fff';
        tabStats.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        tabStats.style.color = '#2c4a3e';
        
        tabHistory.style.background = 'transparent';
        tabHistory.style.boxShadow = 'none';
        tabHistory.style.color = '#888';

        // Hiển thị nội dung
        contentStats.style.display = 'block';
        contentHistory.style.display = 'none';
    });

    tabHistory.addEventListener('click', () => {
        // Đổi màu nút
        tabHistory.style.background = '#fff';
        tabHistory.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        tabHistory.style.color = '#2c4a3e';
        
        tabStats.style.background = 'transparent';
        tabStats.style.boxShadow = 'none';
        tabStats.style.color = '#888';

        // Hiển thị nội dung
        contentHistory.style.display = 'block';
        contentStats.style.display = 'none';
    });
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

// ==========================================
// HỆ THỐNG TỦ CÚP (TROPHY ROOM)
// ==========================================

// Danh mục toàn bộ Huy hiệu trong Game
const BADGE_CATALOG = [
    { id: 0, group: "1. Giai đoạn Khởi Nguyên", name: "Hạt Giống Tỉnh Thức", desc: "Đã gieo cho mình hạt giống Thiền Định." },
    { id: 1, group: "2. Giai đoạn Tăng Trưởng (1 sao)", name: "1 giờ", desc: "Hoàn thành 1 giờ thiền định đầu tiên." },
    { id: 2, group: "2. Giai đoạn Tăng Trưởng (1 sao)", name: "2 giờ", desc: "Tích lũy đủ 2 giờ thiền định." },
    { id: 5, group: "2. Giai đoạn Tăng Trưởng (1 sao)", name: "5 giờ", desc: "Tích lũy đủ 5 giờ thiền định." },
    { id: 10, group: "3. Giai đoạn Tĩnh Tại (2 sao)", name: "10 giờ", desc: "Tích lũy đủ 10 giờ thiền định." },
    { id: 20, group: "3. Giai đoạn Tĩnh Tại (2 sao)", name: "20 giờ", desc: "Tích lũy đủ 20 giờ thiền định." },
    { id: 50, group: "3. Giai đoạn Tĩnh Tại (2 sao)", name: "50 giờ", desc: "Tích lũy đủ 50 giờ thiền định." },
    { id: 100, group: "4. Giai đoạn Khai Sáng (3 sao)", name: "100 giờ", desc: "Tích lũy đủ 100 giờ thiền định." },
    { id: 200, group: "4. Giai đoạn Khai Sáng (3 sao)", name: "200 giờ", desc: "Tích lũy đủ 200 giờ thiền định." },
    { id: 500, group: "4. Giai đoạn Khai Sáng (3 sao)", name: "500 giờ", desc: "Tích lũy đủ 500 giờ thiền định." },
    { id: 1000, group: "5. Giai đoạn Đại Tỉnh Thức", name: "Tuệ Giác", desc: "Tích lũy đủ 1000 giờ thiền định. Trí tuệ bắt đầu bừng sáng, thấu suốt thực tại." },
    { id: 2000, group: "5. Giai đoạn Đại Tỉnh Thức", name: "Nhất Thể", desc: "Tích lũy đủ 2000 giờ thiền định. Kết nối sâu sắc, hòa điệu với vạn vật." },
    { id: 5000, group: "5. Giai đoạn Đại Tỉnh Thức", name: "Đại Viên Mãn", desc: "Tích lũy đủ 5000 giờ thiền định. Chạm đến trạng thái Thiền Định tuyệt đối, nhận thức sâu sắc thế giới quan." }
];
// ==========================================
// HỆ THỐNG DẤU ẤN KIÊN ĐỊNH (WEEK STREAK)
// ==========================================

const STREAK_CATALOG = [
    { id: 10, group: "1. Nền Tảng Kiên Định", name: "Dòng Chảy Tĩnh Lặng", desc: "Duy trì thực hành 10 tuần liên tiếp." },
    { id: 20, group: "1. Nền Tảng Kiên Định", name: "Suối Nguồn An Vui", desc: "Duy trì thực hành 20 tuần liên tiếp." },
    { id: 50, group: "1. Nền Tảng Kiên Định", name: "Tâm Kiên Định", desc: "Giữ vững nhịp độ tu tập suốt 50 tuần (gần 1 năm)." },
    { id: 100, group: "2. Chặng Đường Tỉnh Thức", name: "Bước Chân Tỉnh Thức", desc: "100 tuần không rời bỏ chánh niệm." },
    { id: 200, group: "2. Chặng Đường Tỉnh Thức", name: "Tâm Tĩnh Trí Sáng", desc: "Duy trì thực hành 200 tuần liên tiếp." },
    { id: 500, group: "2. Chặng Đường Tỉnh Thức", name: "Đạo Tâm Bất Thoái", desc: "Duy trì thực hành 500 tuần liên tiếp." },
    { id: 1000, group: "3. Nhất Tâm Bất Loạn", name: "Kim Cương Tâm", desc: "1000 tuần tinh tấn, thiền định đã hòa làm một với hơi thở." }
];

function generateStreakSVG(weeks) {
    let gradientId, fillConfig, dropShadow;
    let textColor = "#ffffff"; // Mặc định chữ màu trắng

    // Phân nhóm 3 dải màu theo đúng yêu cầu
    if (weeks <= 50) {
        // Nhóm 1: Màu Đồng / Đất Nung (Earth Bronze)
        gradientId = `streak-earth-${weeks}`;
        fillConfig = `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ba8759" />
                        <stop offset="100%" stop-color="#8c5a35" />
                      </linearGradient>`;
        dropShadow = '';
    } else if (weeks <= 500) {
        // Nhóm 2: Xanh Lục Bảo sâu (Deep Emerald)
        gradientId = `streak-emerald-${weeks}`;
        fillConfig = `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#4a7c82" />
                        <stop offset="100%" stop-color="#1e3b3e" />
                      </linearGradient>`;
        dropShadow = '';
    } else {
        // Nhóm 3 (1000w): Kim Cương Tỏa Sáng (Glowing Diamond)
        gradientId = `streak-diamond-${weeks}`;
        fillConfig = `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ffffff" />
                        <stop offset="40%" stop-color="#f0fbfe" />
                        <stop offset="100%" stop-color="#a8e4ee" />
                      </linearGradient>
                      <filter id="glow-diamond" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>`;
        dropShadow = 'filter="url(#glow-diamond)"';
        textColor = "#124a52"; // Chữ màu xanh thẫm để nổi bật trên nền kim cương sáng
    }

    // Tọa độ vẽ Lục giác bo tròn góc (Rounded Hexagon)
    const hexPath = "M50 4 C53 4 56 6 58 7.5 L88 25 C92 27 94 30 94 34 L94 66 C94 70 92 73 88 75 L58 92.5 C56 94 53 96 50 96 C47 96 44 94 42 92.5 L12 75 C8 73 6 70 6 66 L6 34 C6 30 8 27 12 25 L42 7.5 C44 6 47 4 50 4 Z";
    
    return `
    <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
            ${fillConfig}
        </defs>
        <path d="${hexPath}" fill="url(#${gradientId})" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" ${dropShadow}></path>
        
        <!-- Căn chỉnh con số và chữ 'w' -->
        <text x="50" y="58" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="28" fill="${textColor}" text-anchor="middle" letter-spacing="0.5">
            ${weeks}<tspan font-size="18" font-weight="600" dy="-1">w</tspan>
        </text>
    </svg>`;
}

// ==========================================
// HÀM VẼ SVG: VIÊN ĐÁ CUỘI (BENEFIT PEBBLE)
// ==========================================
function generateBenefitSVG(groupClass, emoji) {
    let colorStart, colorEnd;
    
    // Luôn luôn vẽ màu Gốc (Màu xám khóa sẽ do CSS .trophy-locked đảm nhận)
    if (groupClass === "emotional") {
        colorStart = "#f6d365"; colorEnd = "#fda085"; 
    } else if (groupClass === "physical") {
        colorStart = "#84fab0"; colorEnd = "#8fd3f4"; 
    } else { 
        colorStart = "#667eea"; colorEnd = "#764ba2"; 
    }

    // Hình dáng Pebble (Đá cuội) đã được vuốt lại để bất đối xứng, tự nhiên và dẹt hơn
    const pebblePath = "M 50 8 C 75 10 95 30 90 65 C 85 90 40 95 15 75 C -5 50 15 10 50 8 Z";

    return `
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad-${groupClass}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${colorStart}" />
                <stop offset="100%" stop-color="${colorEnd}" />
            </linearGradient>
            <filter id="shadow-pebble" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.2"/>
            </filter>
        </defs>
        <path d="${pebblePath}" fill="url(#grad-${groupClass})" filter="url(#shadow-pebble)"/>
        
        <!-- Tăng độ đậm của vầng sáng trắng lên 60% để cách ly màu tốt hơn -->
        <circle cx="50" cy="53" r="22" fill="rgba(255,255,255,0.6)" />
        
        <!-- Thêm style text-shadow (bóng đổ viền đen mờ) để Emoji nổi bật 3D khỏi nền -->
        <text x="50" y="56" font-size="32" text-anchor="middle" dominant-baseline="middle" style="text-shadow: 0px 3px 6px rgba(0,0,0,0.3);">${emoji}</text>
    </svg>`;
}

// Hàm gom nhóm Badge theo "group"
function groupBy(array, key) {
    return array.reduce((result, currentValue) => {
        (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
        return result;
    }, {});
}

// ==========================================
// UNIVERSAL CONTEXTUAL MODAL (DẤU ẤN HÀNH TRÌNH ĐỘNG)
// ==========================================

window.openCategoryModal = function(type, targetName = null) {
    const modalTitle = document.getElementById('universal-modal-title');
    const trophyGrid = document.getElementById('trophy-grid');
    const detailBox = document.getElementById('trophy-detail-box');
    const modal = document.getElementById('trophy-modal');
    
    let html = '';
    const history = JSON.parse(localStorage.getItem('zenPracticeHistory')) || [];

    // Reset lại Box chi tiết hiển thị mặc định
    detailBox.innerHTML = `
        <div id="trophy-detail-icon" style="width: 100px; height: 100px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: transparent;">
            <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#f0f2f1" stroke="#eae3d5" stroke-width="2" stroke-dasharray="4 4"/></svg>
        </div>
        <div>
            <div id="trophy-detail-name" style="font-size: 16px; font-weight: 700; color: #2c4a3e;">Chạm để khám phá</div>
            <div id="trophy-detail-desc" style="font-size: 13px; color: #666; margin-top: 4px;">Chọn một dấu ấn bên dưới để xem thành tựu bạn đã đạt được trên hành trình.</div>
        </div>
    `;

    // -----------------------------------------------------
    // 1. MỞ DẤU ẤN THỜI GIAN
    // -----------------------------------------------------
    if (type === 'time') {
        modalTitle.innerHTML = '⏳ Dấu ấn Thời gian';
        let totalMinutes = 0;
        history.forEach(r => totalMinutes += (parseInt(r.duration) || 0));
        const totalHours = totalMinutes / 60;

        const groupedBadges = groupBy(BADGE_CATALOG, 'group');
        for (const groupName in groupedBadges) {
            html += `<div class="trophy-group-title">${groupName}</div><div class="trophy-badges-container">`;
            groupedBadges[groupName].forEach(badge => {
                const isUnlocked = totalHours >= badge.id;
                const lockedClass = isUnlocked ? '' : 'trophy-locked';
                const svgIcon = generateBadgeSVG(badge.id); 
                
                // Truyền data ngầm qua data-attributes, tránh lỗi chuỗi nháy đơn
                html += `
                    <div class="trophy-badge-item ${lockedClass}" 
                         data-name="${badge.name}"
                         data-desc="${badge.desc}"
                         data-unlocked="${isUnlocked}"
                         onclick="viewDynamicDetail(this)">
                        ${svgIcon}
                    </div>
                `;
            });
            html += `</div>`;
        }
    } 
    
    // -----------------------------------------------------
    // 2. MỞ DẤU ẤN KIÊN ĐỊNH (STREAK)
    // -----------------------------------------------------
    else if (type === 'streak') {
        modalTitle.innerHTML = '🛡️ Dấu ấn Kiên định';
        
        let weekStarts = new Set();
        history.forEach(r => {
            let d = new Date(r.isoDate || r.timestamp);
            let day = d.getDay();
            let diff = d.getDate() - day + (day === 0 ? -6 : 1);
            weekStarts.add(new Date(d.setDate(diff)).setHours(0,0,0,0));
        });
        let sortedWeeks = Array.from(weekStarts).sort((a, b) => b - a);
        let longestStreak = 0, tempLongest = 0;
        if (sortedWeeks.length > 0) {
            longestStreak = 1; tempLongest = 1;
            for (let i = 0; i < sortedWeeks.length - 1; i++) {
                if (sortedWeeks[i] - sortedWeeks[i+1] === 7 * 24 * 60 * 60 * 1000) {
                    tempLongest++;
                    if (tempLongest > longestStreak) longestStreak = tempLongest;
                } else tempLongest = 1;
            }
        }

        const groupedStreaks = groupBy(STREAK_CATALOG, 'group');
        for (const groupName in groupedStreaks) {
            html += `<div class="trophy-group-title">${groupName}</div><div class="trophy-badges-container">`;
            groupedStreaks[groupName].forEach(badge => {
                const isUnlocked = longestStreak >= badge.id;
                const lockedClass = isUnlocked ? '' : 'trophy-locked';
                const svgIcon = generateStreakSVG(badge.id);
                
                html += `
                    <div class="trophy-badge-item ${lockedClass}" 
                         data-name="${badge.name}"
                         data-desc="${badge.desc}"
                         data-unlocked="${isUnlocked}"
                         onclick="viewDynamicDetail(this)">
                        ${svgIcon}
                    </div>
                `;
            });
            html += `</div>`;
        }
    }

    // -----------------------------------------------------
    // 3. MỞ THÀNH QUẢ (BENEFITS)
    // -----------------------------------------------------
    else if (type === 'benefit') {
        modalTitle.innerHTML = '🌿 Thành quả Thiền tập';
        
        let benefitCounts = {};
        history.forEach(r => {
            if (r.benefits) r.benefits.forEach(b => benefitCounts[b] = (benefitCounts[b] || 0) + 1);
        });

        BENEFITS_CONFIG.forEach(category => {
            html += `<div class="trophy-group-title">${category.categoryTitle}</div><div class="trophy-badges-container">`;
            
            category.items.forEach(item => {
                const count = benefitCounts[item.value] || 0;
                
                // LOGIC MỚI: Chỉ mở khóa khi đạt 100 lần
                const isUnlocked = count >= 100;
                const lockedClass = isUnlocked ? '' : 'trophy-locked'; 
                
                const emoji = item.label.split(' ')[0];
                const svgIcon = generateBenefitSVG(item.groupClass, emoji);
                
                // Cập nhật text hiển thị tiến độ
                const desc = `Tiến độ: ${count}/100 lần.<br>Bạn đã tìm thấy sự ${item.value.toLowerCase()} thông qua các buổi thiền định.`;
                
                html += `
                    <div class="trophy-badge-item ${lockedClass}" style="width: 64px; height: 64px;"
                         data-name="${item.value}"
                         data-desc="${desc}"
                         data-unlocked="${isUnlocked}"
                         onclick="viewDynamicDetail(this)">
                        ${svgIcon}
                    </div>
                `;
            });
            html += `</div>`;
        });
    }

    trophyGrid.innerHTML = html;
    modal.classList.remove('hidden');
    document.body.classList.add('no-scroll'); document.documentElement.classList.add('no-scroll');
    // =====================================
    // LOGIC FOCUS & TỰ ĐỘNG CUỘN ĐẾN BADGE
    // =====================================
    if (targetName) {
        // Đợi 50ms để DOM kịp in toàn bộ các badge mới ra màn hình
        setTimeout(() => {
            const targetBadge = trophyGrid.querySelector(`[data-name="${targetName}"]`);
            if (targetBadge) {
                // 1. Giả lập một cú chạm để thông tin nhảy lên Box chi tiết phía trên
                viewDynamicDetail(targetBadge);
                
                // 2. Tự động cuộn danh sách (lưới) đến đúng vị trí của Badge này
                targetBadge.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // 3. Hiệu ứng nhịp đập (Pulse) nhẹ để người dùng biết mắt cần nhìn vào đâu
                targetBadge.style.transform = 'scale(1.15)';
                setTimeout(() => { targetBadge.style.transform = 'none'; }, 400);
            }
        }, 50);
    }
}

// Hàm render dữ liệu Động lấy trực tiếp từ phần tử HTML bị bấm
window.viewDynamicDetail = function(element) {
    const name = element.getAttribute('data-name');
    const desc = element.getAttribute('data-desc');
    const isUnlocked = element.getAttribute('data-unlocked') === 'true';
    
    // Tuyệt chiêu: Lấy thẳng cái hình SVG trong danh sách đắp lên Box chi tiết
    const svgContent = element.innerHTML; 

    const detailIcon = document.getElementById('trophy-detail-icon');
    const detailName = document.getElementById('trophy-detail-name');
    const detailDesc = document.getElementById('trophy-detail-desc');

    detailIcon.innerHTML = svgContent;
    // Hủy bỏ bộ lọc xám (grayscale) để dù chưa mở khóa, Box chi tiết vẫn hiện FULL màu
    detailIcon.style.filter = 'none'; 
    
    detailName.innerText = name;
    
    if (isUnlocked) {
        detailName.style.color = "#2c4a3e";
        detailDesc.innerHTML = `✅ <b>Thành tựu của bạn:</b><br> ${desc}`;
    } else {
        detailName.style.color = "#888";
        detailDesc.innerHTML = `🔒 <b>Chưa mở khóa:</b><br> ${desc}`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const btnClose = document.getElementById('btn-close-trophy');
    const modal = document.getElementById('trophy-modal');

    if (btnClose && modal) {
        btnClose.addEventListener('click', () => {
            modal.classList.add('hidden');
            document.body.classList.remove('no-scroll'); document.documentElement.classList.remove('no-scroll');
        });
    }
});
    
