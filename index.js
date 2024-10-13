const express = require('express');
const { exec } = require('child_process');
const app = express();
const Docker = require('dockerode');
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
    exec(`docker compose up -d`, { "shell": "/bin/bash", "cwd": "/home/schizo/dc/media" }, (error, stdout, stderr) => {
      if (error) {
          console.error(`error: ${error.message}`);
          throw (error);
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
        throw (stderr);
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
          throw (error);
        }
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
        throw (error);
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
        throw (stderr);
      }
      resolve(stdout);
    });
  });
}


app.get('/', async (req, res) => {
  // generate a webpage with one restart button and one stop button
  res.send(`
    <html>
      <body>
        <h1>Restart and stop squeezelite container</h1>
        <form action="/restart" method="get">
          <button type="submit">Restart</button>
        </form>
        <form action="/stop" method="get">
          <button type="submit">Stop</button>
        </form>
        <form action="/start" method="get">
          <button type="submit">Start</button>
        </form>
      </body>
    </html>
  `);
});

app.get('/restart', async (req, res) => {
  try {
    await systemctl("restart", "pulseaudio")
    await delay(100)
    let status = await systemctl("is-active", "pulseaudio")
    if (status == "active\n") {
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

