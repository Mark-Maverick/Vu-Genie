// Cursor behavior
const smallCursor = document.querySelector('.sCursor');
const largeCursor = document.querySelector('.lCursor');

document.body.addEventListener('mousemove', (event) => {
    const { x, y } = event;
    smallCursor.style.left = `${x}px`;
    smallCursor.style.top = `${y}px`;
    largeCursor.style.left = `${x - 20}px`;
    largeCursor.style.top = `${y - 20}px`;
});

// Utility functions
async function getActiveTab() {
    const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });
    return activeTab;
}

function showMessage(element, message) {
    element._originalText = element._originalText || element.textContent;
    element.textContent = message;
    element.setAttribute('disabled', 'true');

    clearTimeout(element._timeout);
    element._timeout = setTimeout(() => {
        element.textContent = element._originalText;
        element.removeAttribute('disabled');
    }, 2000);
}

// Set version string
const versionString = document.getElementById('version-string');
versionString.textContent = chrome.runtime.getManifest().version;

// Bypass video handler
document.getElementById('bypass-video').addEventListener('click', async (event) => {
    const activeTab = await getActiveTab();
    const button = event.target.closest('button');

    if (!activeTab.url.includes('vulms.vu.edu.pk') || !activeTab.url.includes('LessonViewer.aspx')) {
        return showMessage(button, 'Only works on Lesson page.');
    }

    showMessage(button, 'In Progress');

    chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        world: 'MAIN',
        func: () => {
            return new Promise((resolve) => {
                const currentTabId = $('#hfActiveTab').val().replace('tabHeader', '');
                const nextTab = document.querySelector(`li[data-contentid="tab${currentTabId}"]`).nextElementSibling;
                const nextTabId = nextTab?.dataset?.contentid?.replace('tab', '') || '-1';
                const isVideoTab = $('#hfIsVideo' + currentTabId)?.val();

                if (!isVideoTab || isVideoTab === '0') {
                    return resolve('Not a video tab');
                }

                const studentID = $('#hfStudentID').val();
                const courseCode = $('#hfCourseCode').val();
                const enrollmentSemester = $('#hfEnrollmentSemester').val();
                const lessonTitle = document.getElementById('MainContent_lblLessonTitle').title.split(':')[0].replace('Lesson', '').trim();
                const videoDuration = $('#hfContentID' + currentTabId).val();
                const isAvailableOnYouTube = $('#hfIsAvailableOnYoutube' + currentTabId).val();
                const isAvailableLocally = $('#hfIsAvailableOnLocal' + currentTabId).val();
                const videoID = $('#hfVideoID' + currentTabId).val();
                
                function getRandomDuration(min, max) {
                    return Math.floor(Math.random() * (max - min + 1) + min);
                }

                let duration = '';
                if (isAvailableOnYouTube === 'True') {
                    duration = CurrentPlayer.getDuration();
                } else if (isAvailableLocally === 'True') {
                    duration = CurrentLVPlayer.duration;
                }

                let randomDuration = getRandomDuration(120, 180);
                if (isAvailableOnYouTube === 'True' || isAvailableLocally === 'True') {
                    randomDuration = getRandomDuration(Number(duration) / 3, Number(duration) / 2);
                }

                PageMethods.SaveStudentVideoLog(
                    studentID, courseCode, enrollmentSemester, lessonTitle,
                    videoDuration, randomDuration, duration, videoID, isVideoTab,
                    window.location.href, (status) => {
                        UpdateTabStatus(status, currentTabId, nextTabId);
                        resolve('Viewed');
                    }
                );
            });
        }
    }).then((results) => {
        const resultMessage = results[0]?.result || 'Unknown Error';
        showMessage(button, resultMessage);
    });
});

// Allow events handler
document.getElementById('allow-events').addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    showMessage(button, 'Processing');

    chrome.scripting.executeScript({
        target: { tabId: (await getActiveTab()).id, allFrames: true },
        world: 'MAIN',
        func: () => {
            if (typeof window.Node?.prototype?._getEventListeners !== 'function') {
                return 'Not supported';
            }

            const elements = [...document.querySelectorAll('*'), document, window];
            const restrictedEvents = ['copy', 'paste', 'cut', 'contextmenu', 'keyup', 'keypress', 'keydown', 'auxclick'];

            elements.forEach((el) => {
                const listeners = el._getEventListeners?.();
                if (!listeners) return;

                for (const [event, handlers] of Object.entries(listeners)) {
                    if (!restrictedEvents.includes(event)) continue;
                    handlers.forEach((handler) => handler.controller.abort());
                }
            });
        }
    }).then((results) => {
        const isNotSupported = results.every((res) => typeof res.result === 'string');
        showMessage(button, isNotSupported ? 'Not supported on this page.' : 'Done! You can now copy, paste.');
    });
});

// Handle GDB copy-paste visibility
getActiveTab().then((activeTab) => {
    if (activeTab.url.includes('vulms.vu.edu.pk') && activeTab.url.includes('GDB/StudentMessage.aspx')) {
        document.getElementById('gdb-copy-paste').classList.remove('hidden');
    }
});
