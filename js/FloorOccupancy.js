        /* ── Static time configuration ── */
        const STATIC_TIME = "14:00"; // format HH:MM  ← change only this line

        function parseStaticTime() {
            const [hours, minutes] = STATIC_TIME.split(':').map(Number);
            return { hour: hours, minute: minutes };
        }

        /* All time helpers now read from STATIC_TIME */
        function getNowHour() { return parseStaticTime().hour; }
        function getNowMin()  { return parseStaticTime().minute; }
        function formatNow()  { return STATIC_TIME; }

        const roomsData = [
            {
                id: 1, number: '101', Name: 'Main Lobby', status: 'Online', floor: 1, peopleNum: 2, lastUpdate: '20',
                trend: [0, 4, 0, 1, 1, 2, 3, 4, 3, 2, 2, 3, 4, 3, 2, 2, 3, 2, 1, 1, 0, 0, 0, 0]
            },
            {
                id: 2, number: '102', Name: 'Lecture Room', status: 'Offline', floor: 1, peopleNum: 0, lastUpdate: '20',
                trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            },
            {
                id: 3, number: '103', Name: 'Office Room', status: 'Online', floor: 1, peopleNum: 4, lastUpdate: '20',
                trend: [0, 0, 0, 0, 1, 2, 4, 5, 6, 5, 4, 3, 4, 5, 4, 5, 4, 3, 2, 1, 0, 0, 0, 0]
            },
            {
                id: 4, number: '201', Name: 'Lecture Hall', status: 'Online', floor: 2, peopleNum: 1, lastUpdate: '20',
                trend: [0, 0, 0, 0, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 1, 3, 2, 1, 1, 0, 0, 0, 0, 0]
            },
            {
                id: 5, number: '202', Name: 'Conference Room', status: 'Offline', floor: 2, peopleNum: 0, lastUpdate: '20',
                trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            }
        ];

        let currentSort    = "asc";
        let searchTerm     = "";
        let selectedRoomId = null;
        let roomChart      = null;

        /* 24-hour labels */
        const hours = Array.from({ length: 24 }, (_, i) =>  
            `${String(i).padStart(2, '0')}:00`
        );

        /* Past hours (≤ static hour) show real data; future hours are null */
        function buildPastData(trend) {
            const nowH = getNowHour();
            return trend.map((val, i) => i <= nowH ? val : null);
        }

        /* Future hours (≥ static hour) show a flat 0 dim dashed line; past are null */
        function buildFutureData(trend) {
            const nowH = getNowHour();
            return trend.map((_, i) => i >= nowH ? 0 : null);
        }

        const nowLinePlugin = {
            id: 'nowLine',
            afterDraw(chart) {
                const nowH = getNowHour();
                const nowM = getNowMin();
                const { ctx, scales: { x, y } } = chart;

                /* Interpolate X pixel between current hour tick and next */
                const x0   = x.getPixelForValue(nowH);
                const x1   = nowH < 23 ? x.getPixelForValue(nowH + 1) : x0;
                const xPos = x0 + (x1 - x0) * (nowM / 60);

                ctx.save();

                /* Dashed vertical line */
                ctx.beginPath();
                ctx.setLineDash([5, 4]);
                ctx.strokeStyle = '#f39c12';
                ctx.lineWidth   = 1.8;
                ctx.moveTo(xPos, y.top);
                ctx.lineTo(xPos, y.bottom);
                ctx.stroke();
                ctx.setLineDash([]);

                /* Pill label */
                const label = `NOW  ${formatNow()}`;
                ctx.font = 'bold 10px Segoe UI, sans-serif';
                const tw  = ctx.measureText(label).width;
                const pw  = tw + 16, ph = 22, pr = 5;

                /* Keep pill within chart horizontal bounds */
                let lx = xPos - pw / 2;
                if (lx < x.left)       lx = x.left;
                if (lx + pw > x.right) lx = x.right - pw;
                const ly = y.top - 30;

                /* Pill background */
                ctx.fillStyle = '#f39c12';
                ctx.beginPath();
                ctx.roundRect(lx, ly, pw, ph, pr);
                ctx.fill();

                /* Arrow pointer below pill */
                ctx.beginPath();
                ctx.moveTo(xPos - 5, ly + ph);
                ctx.lineTo(xPos + 5, ly + ph);
                ctx.lineTo(xPos,     ly + ph + 7);
                ctx.closePath();
                ctx.fillStyle = '#f39c12';
                ctx.fill();

                /* Pill text */
                ctx.fillStyle    = '#1a1a1a';
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, lx + pw / 2, ly + ph / 2);

                ctx.restore();
            }
        };

        /* ── Init ── */
        document.addEventListener("DOMContentLoaded", () => {
            renderRoomList();
            document.getElementById("searchInput").addEventListener("input", e => {
                searchTerm = e.target.value.toLowerCase();
                renderRoomList();
            });
            document.getElementById("floorFilter").addEventListener("change", renderRoomList);
            document.getElementById("sortField").addEventListener("change", renderRoomList);
        });

        function setSort(direction, event) {
            currentSort = direction;
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            event.target.classList.add("active");
            renderRoomList();
        }

        function getRooms() {
            const floor     = document.getElementById("floorFilter").value;
            const sortField = document.getElementById("sortField").value;

            let filtered = roomsData.filter(room => {
                const matchSearch =
                    room.number.includes(searchTerm) ||
                    room.Name.toLowerCase().includes(searchTerm) ||
                    room.status.toLowerCase().includes(searchTerm);
                const matchFloor = (floor === "all" || room.floor == floor);
                return matchSearch && matchFloor;
            });

            filtered.sort((a, b) => {
                let valA = a[sortField];
                let valB = b[sortField];
                if (["number","floor","peopleNum"].includes(sortField)) {
                    valA = parseInt(valA); valB = parseInt(valB);
                } else {
                    valA = String(valA).toLowerCase();
                    valB = String(valB).toLowerCase();
                }
                if (currentSort === "asc") return valA > valB ? 1 : valA < valB ? -1 : 0;
                else                       return valA < valB ? 1 : valA > valB ? -1 : 0;
            });

            return filtered;
        }

        function renderRoomList() {
            const rooms = getRooms();
            document.getElementById("roomList").innerHTML = rooms.map(room => `
                <div class="room-item ${selectedRoomId === room.id ? 'selected' : ''}"
                     onclick="selectRoom(${room.id})">
                    <div class="room-number">Room ${room.number}</div>
                    <div class="room-info">${room.Name}</div>
                    <div class="room-info">People: ${room.peopleNum}</div>
                    <span class="room-status status-${room.status}">${room.status}</span>
                    <div class="room-info">Last Updated: ${room.lastUpdate} Seconds Ago</div>
                </div>
            `).join("");
        }

        function selectRoom(id) {
            selectedRoomId = id;
            renderRoomList();

            const room  = roomsData.find(r => r.id === id);
            const nowH  = getNowHour();

            document.getElementById("detailsPanel").innerHTML = `
                <div class="right-panel-header">
                    <h2 class="details-header">Room ${room.number}</h2>
                    <div class="room-status status-${room.status}"
                         style="display:inline-block;font-size:14px;padding:4px 12px;">
                        ${room.status}
                    </div>
                </div>

                <div class="details-content">
                    <div class="detail-item">
                        <div class="detail-label">Room Name</div>
                        <div class="detail-value">${room.Name}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Floor</div>
                        <div class="detail-value">Floor ${room.floor}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">People Count</div>
                        <div class="detail-value"
                             style="color:${room.peopleNum > 0 ? '#2ecc71' : '#e74c3c'};font-size:28px;">
                            ${room.peopleNum}
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Last Updated</div>
                        <div class="detail-value">${room.lastUpdate} seconds ago</div>
                    </div>
                </div>

                <div class="chart-section">
                    <div class="chart-header">
                        <div class="chart-title">Hourly Occupancy — Today</div>
                        <div class="now-badge">&#9679; ${formatNow()}</div>
                    </div>
                    <canvas id="room-chart" height="130"></canvas>
                </div>
            `;

            /* Destroy previous chart */
            if (roomChart) { roomChart.destroy(); roomChart = null; }

            const lineColor = room.status === 'Online' ? '#2ecc71' : '#e74c3c';
            const fillColor = room.status === 'Online'
                ? 'rgba(46,204,113,0.18)'
                : 'rgba(231,76,60,0.18)';

            roomChart = new Chart(document.getElementById("room-chart"), {
                type: 'line',
                plugins: [nowLinePlugin],
                data: {
                    labels: hours,
                    datasets: [
                        /* Dataset 1 — Past & current: real data, colored line */
                        {
                            label: 'People Count',
                            data: buildPastData(room.trend),
                            borderColor: lineColor,
                            backgroundColor: fillColor,
                            fill: true,
                            tension: 0.4,
                            spanGaps: false,
                            pointRadius: buildPastData(room.trend).map((_, i) =>
                                i === nowH ? 5 : 2
                            ),
                            pointBackgroundColor: buildPastData(room.trend).map((_, i) =>
                                i === nowH ? '#f39c12' : lineColor
                            ),
                            pointBorderColor: buildPastData(room.trend).map((_, i) =>
                                i === nowH ? '#f39c12' : lineColor
                            )
                        },
                        /* Dataset 2 — Future: flat 0, dim dashed, no fill */
                        {
                            label: '_future',
                            data: buildFutureData(room.trend),
                            borderColor: 'rgba(255,255,255,0.12)',
                            backgroundColor: 'transparent',
                            borderDash: [4, 4],
                            fill: false,
                            tension: 0,
                            spanGaps: false,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    layout: { padding: { top: 38 } },
                    plugins: {
                        legend: {
                            labels: {
                                color: 'rgba(255,255,255,0.6)',
                                font: { size: 11 },
                                filter: item => item.text !== '_future'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15,30,50,0.95)',
                            titleColor: 'white',
                            bodyColor: 'rgba(255,255,255,0.8)',
                            borderColor: 'rgba(255,255,255,0.15)',
                            borderWidth: 1,
                            filter: item => item.datasetIndex === 0,
                            callbacks: {
                                label: ctx => `  ${ctx.parsed.y} people`
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: 'rgba(255,255,255,0.5)',
                                maxRotation: 0,
                                maxTicksLimit: 12,
                                font: { size: 11 }
                            },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: 'rgba(255,255,255,0.5)',
                                stepSize: 1,
                                font: { size: 11 }
                            },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        }
                    }
                }
            });
        }