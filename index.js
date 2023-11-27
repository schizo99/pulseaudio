const express = require('express');
const { exec } = require('child_process');
const app = express();
const Docker = require('dockerode');
const docker = new Docker();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))


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

const systemctl = async (command, service) => {
  return new Promise((resolve, reject) => {
    exec(`systemctl ${command} ${service} --user`, { "shell": "/bin/bash" }, (error, stdout, stderr) => {
      if (error) {
        if (error.code === 3 && command != "is-active") {
          console.error(`error: ${error.message}`);
          throw (error);
        }
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
  try {
    await systemctl("restart", "pulseaudio")
    await delay(100)
    let status = await systemctl("is-active", "pulseaudio")
    if (status != "active\n") {
      console.log("Unable to restart Pulseaudio")
      res.send("Unable to restart Pulseaudio")
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
//    await systemctl("stop", "mpg123")
//    await delay(500)
//    await systemctl("start", "mpg123")
//    await delay(1000)
//    let status_ok = false
//    let counter = 0
//    while (!status_ok && counter < 5) {
//      status = await systemctl("is-active", "mpg123")
//      if (status != "active\n" && status === "activating\n") {
//        counter++
//        console.log("mpg123 still starting!")
//        await delay(2000)
//      } else if (status === "active\n") {
//        status_ok = true
//      }
//    }
//    if (status_ok) {
      // console.log("Pulseaudio successfully restarted")
      // res.send("Pulseaudio successfully restarted")
//    } else {
//      console.log("Failed to restart Pulseaudio")
//      res.status(500)
//      res.send("Failed to restart Pulseaudio")
//    }
  } catch (error) {
    console.log("Unable to restarting services.", error)
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

