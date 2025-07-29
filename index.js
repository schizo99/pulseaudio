const express = require('express');
const { exec } = require('child_process');
const app = express();
const Docker = require('dockerode');
const DockerCompose = require('dockerode-compose');
const docker = new Docker();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const device = process.env.DEVICE || '00:13:EF:BF:FA:D6';

const restartContainer = async () => {
  let containers = await docker.listContainers();
  let c = containers.filter(c => c.Names.includes("/squeezelite"));
  let container = docker.getContainer(c[0].Id);
  try {
      await container.restart()
      return "", true
  } catch (error) {
      console.log(error)
      return error, false
  }
}

const stopContainer = async () => {
  let containers = await docker.listContainers();
  let c = containers.filter(c => c.Names.includes("/squeezelite"));
  let container = docker.getContainer(c[0].Id);
  try {
      await container.stop()
      return "", true
  } catch (error) {
      console.log(error)
      return error, false
  }
}

const startContainer = async () => {
  return new Promise((resolve, reject) => {
    exec(`docker compose -f /app/lms/docker-compose.yml up -d --no-recreate`, (error, stdout, stderr) => {
      if (error) {
          console.error(`error: ${error.message}`);
          reject(error);
      }
      resolve(stdout);
    });
  });
}

const systemctl = async (command, service) => {
  return new Promise((resolve, reject) => {
    exec(`systemctl ${command} ${service} --user`, { "shell": "/bin/bash" }, (error, stdout, stderr) => {
      if (error) {
        if (error.code === 3 && command != "is-active") {
          console.error(`error: ${error.message}`);
          reject(error);
          return;
        }
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
        reject(stderr);
        return;
      }
      resolve(stdout);
    });
  });
}

const bluetoothctl = async (command, device) => {
  return new Promise((resolve, reject) => {
    exec(`bluetoothctl ${command} ${device}`, { "shell": "/bin/bash" }, (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
        reject(error);
        return;
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
        reject(stderr);
        return;
      }
      resolve(stdout);
    });
  });
}


app.get('/', async (req, res) => {
  // generate a webpage with one restart button and one stop button
  res.send(`
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Squeezelite Control Panel</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
          }

          .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            padding: 2rem;
            max-width: 400px;
            width: 90%;
            text-align: center;
          }

          h1 {
            color: #4a5568;
            margin-bottom: 2rem;
            font-size: 1.5rem;
            font-weight: 600;
          }

          .button-group {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .btn {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
            position: relative;
            overflow: hidden;
          }

          .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .btn-restart {
            background: linear-gradient(45deg, #ff6b6b, #ee5a24);
            color: white;
          }

          .btn-stop {
            background: linear-gradient(45deg,rgb(87, 209, 254),rgb(48, 87, 180));
            color: white;
          }

          .btn-start {
            background: linear-gradient(45deg,rgb(72, 228, 184),rgb(2, 138, 70));
            color: white;
          }

          .btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
          }

          .btn:active:not(:disabled) {
            transform: translateY(0);
          }

          .status {
            margin-top: 1.5rem;
            padding: 1rem;
            border-radius: 8px;
            font-weight: 500;
            display: none;
          }

          .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }

          .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f1aeb5;
          }

          .status.loading {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
          }

          .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 10px;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @media (max-width: 480px) {
            .container {
              padding: 1.5rem;
              margin: 1rem;
            }

            h1 {
              font-size: 1.25rem;
            }

            .btn {
              padding: 0.875rem 1rem;
              font-size: 0.9rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Squeezelite Control Panel</h1>
          <div class="button-group">
            <button onclick="performAction('/restart', this)" class="btn btn-restart">
              🔄 Restart Service
            </button>
            <button onclick="performAction('/stop', this)" class="btn btn-stop">
              ⏹️ Stop Service
            </button>
            <button onclick="performAction('/start', this)" class="btn btn-start">
              ▶️ Start Service
            </button>
          </div>
          <div id="status" class="status"></div>
        </div>

        <script>
          async function performAction(url, button) {
            const statusDiv = document.getElementById('status');
            const allButtons = document.querySelectorAll('.btn');

            // Disable all buttons and show loading
            allButtons.forEach(btn => btn.disabled = true);
            statusDiv.className = 'status loading';
            statusDiv.style.display = 'block';
            statusDiv.innerHTML = '<span class="spinner"></span>Processing...';

            try {
              const response = await fetch(url);
              const result = await response.text();

              if (response.ok) {
                statusDiv.className = 'status success';
                statusDiv.innerHTML = '✅ ' + result;
              } else {
                statusDiv.className = 'status error';
                statusDiv.innerHTML = '❌ Error: ' + result;
              }
            } catch (error) {
              statusDiv.className = 'status error';
              statusDiv.innerHTML = '❌ Network error: ' + error.message;
            } finally {
              // Re-enable buttons after a short delay
              setTimeout(() => {
                allButtons.forEach(btn => btn.disabled = false);
              }, 1000);
              // Hide status after 5 seconds
              setTimeout(() => {
                statusDiv.style.display = 'none';
              }, 5000);
            }
          }
        </script>
      </body>
    </html>
  `);
});

app.get('/restart', async (req, res) => {
  try {
    await systemctl("restart", "pulseaudio")
    await delay(100)
    let status = await systemctl("is-active", "pulseaudio")
    if (status != "active\n") {
      console.log("Unable to stop Pulseaudio")
      res.send("Unable to stop Pulseaudio")
      return
    }
    let error, ok = await restartContainer();
    if (ok) {
      console.log("Successfully restarted squeezelite container and pulseaudio")
      res.send("Successfully restarted squeezelite container and pulseaudio")
    } else {
      console.log("Unable to restart squeezelite container", error)
      res.status(500)
      res.send(error)
      return
    }
  } catch (error) {
    console.log("Unable to restarting services.", error)
    res.status(500)
    res.send(error)
  }

});

app.get('/stop', async (req, res) => {
  try {
    let status = await bluetoothctl("disconnect", device)
    console.log(status)
    let error, ok = await stopContainer();
    if (ok) {
      console.log("Successfully stopped squeezelite container and pulseaudio")
      res.send("Successfully stopped squeezelite container and pulseaudio")
    } else {
      console.log("Unable to stop squeezelite container", error)
      res.status(500)
      res.send(error)
      return
    }
  } catch (error) {
    console.log("Unable to stop services.", error)
    res.status(500)
    res.send(error)
  }

});

app.get('/start', async (req, res) => {
  try {
    let status = await startContainer();
    console.log(status)
    if (status != undefined) {
      console.log("Successfully started squeezelite container and pulseaudio")
      res.send("Successfully started squeezelite container and pulseaudio")
    } else {
      console.log("Unable to start squeezelite container", error)
      res.status(500)
      res.send(error)
      return
    }
  } catch (error) {
    console.log("Unable to start squeezelite.", error)
    res.status(500)
    res.send(error)
  }
});

app.listen(3333, () => {
  console.log('Server listening on port 3333');
});

process.on('SIGINT', function () {
  console.log("Caught interrupt signal");
  process.exit();
});

