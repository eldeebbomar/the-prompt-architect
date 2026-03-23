/**
 * LOVABLE DEPLOYER - Content Script
 * 
 * This script runs on lovable.dev and injects the "Deploy Blueprint" UI.
 */

console.log("[Prompt Architect] Lovable Deployer active.");

let deploymentQueue = [];
let isDeploying = false;
let currentProjectName = "";

// 1. Injected UI Styles
const styles = `
  #pa-deploy-node {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #111;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    width: 280px;
    font-family: sans-serif;
    color: white;
  }
  .pa-btn {
    background: #d4a017;
    color: black;
    border: none;
    border-radius: 6px;
    padding: 10px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .pa-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .pa-progress {
    height: 4px;
    background: #222;
    border-radius: 2px;
    overflow: hidden;
  }
  .pa-progress-bar {
    height: 100%;
    background: #d4a017;
    width: 0%;
    transition: width 0.3s;
  }
  .pa-status {
    font-size: 11px;
    color: #888;
  }
`;

// 2. Inject UI
function injectUI() {
  if (document.getElementById('pa-deploy-node')) return;
  
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

  const container = document.createElement("div");
  container.id = "pa-deploy-node";
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span style="font-weight: 600; font-size: 14px;">Prompt Architect</span>
      <span class="pa-status" id="pa-project-name">No Project Found</span>
    </div>
    <button class="pa-btn" id="pa-start-btn">
      <span>🚀</span> Start Auto-Deploy
    </button>
    <div class="pa-progress">
      <div id="pa-bar" class="pa-progress-bar"></div>
    </div>
    <div id="pa-log" class="pa-status">Ready to deploy...</div>
  `;
  document.body.appendChild(container);

  document.getElementById('pa-start-btn').onclick = startDeployment;
}

// 3. Find Lovable Chat Components
function getChatInput() {
  return document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
}

function getSendButton() {
  // Lovable uses diverse button patterns, looking for the send icon or primary button near input
  return document.querySelector('button[type="submit"]') || 
         document.querySelector('button svg path[d*="M2.01 21L23 12 2.01 3"]')?.closest('button');
}

function isAssistantThinking() {
  // Check for typing indicators or disabled inputs
  const input = getChatInput();
  return input?.disabled || !!document.querySelector('.animate-pulse'); // Rough proxy
}

// 4. Deployment Logic
async function startDeployment() {
  if (isDeploying) return;
  
  // Request prompts from the Prompt Architect tab
  window.postMessage({ type: "PA_REQUEST_PROMPTS" }, "*");
}

// Listen for messages from the Web App (via window.postMessage)
window.addEventListener("message", (event) => {
  if (event.data.type === "PA_SEND_PROMPTS") {
    deploymentQueue = event.data.prompts;
    currentProjectName = event.data.projectName;
    document.getElementById('pa-project-name').innerText = currentProjectName;
    runQueue();
  }
});

async function runQueue() {
  isDeploying = true;
  const btn = document.getElementById('pa-start-btn');
  const bar = document.getElementById('pa-bar');
  const log = document.getElementById('pa-log');
  
  btn.disabled = true;
  
  for (let i = 0; i < deploymentQueue.length; i++) {
    const prompt = deploymentQueue[i];
    const progress = Math.round(((i + 1) / deploymentQueue.length) * 100);
    
    log.innerText = `Deploying ${i + 1}/${deploymentQueue.length}...`;
    bar.style.width = `${progress}%`;

    // Wait for the input to be ready
    while (isAssistantThinking()) {
      await new Promise(r => setTimeout(r, 1000));
    }

    const input = getChatInput();
    if (!input) {
      log.innerText = "Error: Input not found!";
      break;
    }

    // Set value and trigger events
    input.value = prompt.prompt_text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    await new Promise(r => setTimeout(r, 500)); // Natural delay

    const sendBtn = getSendButton();
    if (sendBtn) {
      sendBtn.click();
    } else {
      // Fallback: Enter key
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    }

    // Wait for Lovable to start processing
    await new Promise(r => setTimeout(r, 2000));
  }

  log.innerText = "Deployment Complete! 🎉";
  btn.disabled = false;
  btn.innerText = "✅ Deployed";
  isDeploying = false;
}

// Initialize
setTimeout(injectUI, 2000); // Wait for Lovable to load
