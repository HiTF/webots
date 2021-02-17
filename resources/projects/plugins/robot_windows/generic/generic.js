/* global webots: false */
/* global PlotWidget: false */
/* global RadarWidget: false */
/* global TimeplotWidget: false */
/* exported motorSetPosition */
/* exported motorUnsetPosition */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "Callback", "argsIgnorePattern": "^_"}] */

var basicTimeStep = -1;
var robotName = '';
var widgets = {}; // Dictionary {deviceName -> [TimeplotWidget0, PlotWidget0, PlotWidget1, ...] }
var images = {}; // Dictionary {deviceName -> imageDiv }
var commands = []; // Commands to be sent to the C library.
var motorCommands = {}; // Buffered motor commands.
var touchedCheckboxes = []; // Last touched cheboxes.
var supportedDeviceTypes = [
  'Accelerometer', 'Camera', 'Compass', 'DistanceSensor', 'GPS', 'Gyro',
  'InertialUnit', 'Lidar', 'LightSensor', 'LinearMotor', 'PositionSensor',
  'Radar', 'RangeFinder', 'RotationalMotor', 'TouchSensor'
];

function menuTabCallback(deviceType) {
  let i, x, tablinks;
  x = document.getElementsByClassName('devices-container');
  for (i = 0; i < x.length; ++i)
    x[i].style.display = 'none';
  tablinks = document.getElementsByClassName('menu-button');
  for (i = 0; i < x.length; ++i)
    tablinks[i].className = tablinks[i].className.replace(' menu-button-selected', '');
  document.getElementById(deviceType).style.display = 'block';
  document.getElementById(deviceType + '-menu-button').className += ' menu-button-selected';

  // force widgets refresh when they are shown.
  Object.keys(widgets).forEach(function(deviceName) {
    widgets[deviceName].forEach(function(widget) {
      if (widget.device.type === deviceType)
        widget.refresh();
    });
  });
}

function openMenu() {
  document.getElementById('menu').style.display = 'flex';
  document.getElementById('menu-open-button').style.display = 'none';
  document.getElementById('content').style.marginLeft = document.getElementById('menu').offsetWidth + 'px';
}

function closeMenu() {
  document.getElementById('menu-open-button').style.display = 'inline';
  document.getElementById('menu').style.display = 'none';
  document.getElementById('content').style.marginLeft = '0px';
}

function checkboxCallback(checkbox) {
  if (checkbox.checked)
    commands.push(checkbox.getAttribute('device') + ':enable');
  else
    commands.push(checkbox.getAttribute('device') + ':disable');
  touchedCheckboxes.push(checkbox);
}

function cameraRecognitionCheckboxCallback(checkbox) {
  const deviceName = checkbox.getAttribute('device');
  if (checkbox.checked)
    commands.push(deviceName + ':recognitionEnable');
  else
    commands.push(deviceName + ':recognitionDisable');
  const segmentationCheckbox = document.getElementById(deviceName + '-segmentation-checkbox');
  if (segmentationCheckbox)
    segmentationCheckbox.disabled = !checkbox.checked;
  touchedCheckboxes.push(checkbox);
}

function cameraSegmentationCheckboxCallback(checkbox) {
  if (checkbox.checked)
    commands.push(checkbox.getAttribute('device') + ':segmentationEnable');
  else
    commands.push(checkbox.getAttribute('device') + ':segmentationDisable');
  touchedCheckboxes.push(checkbox);
}

function pointCloudCheckboxCallback(checkbox) {
  if (checkbox.checked)
    commands.push(checkbox.getAttribute('device') + ':pointCloudEnable');
  else
    commands.push(checkbox.getAttribute('device') + ':pointCloudDisable');
  touchedCheckboxes.push(checkbox);
}

function comboboxCallback(combobox) {
  const devicePlots = widgets[combobox.getAttribute('device')];
  devicePlots.forEach(function(widget) {
    widget.show(false);
  });
  devicePlots[combobox.selectedIndex].show(true);
}

function motorSetPosition(deviceName, value) {
  widgets[deviceName].forEach(function(widget) {
    widget.blockSliderUpdate(true);
  });
  motorCommands[deviceName] = value;
}

function motorUnsetPosition(deviceName) {
  widgets[deviceName].forEach(function(widget) {
    widget.blockSliderUpdate(false);
  });
  delete motorCommands[deviceName];
}

function appendNewElement(id, newElement) {
  const tmp = document.createElement('tmp');
  tmp.innerHTML = newElement;
  const container = document.getElementById(id);
  container.appendChild(tmp.firstChild);
  return container.childNodes[container.childNodes.length - 1];
}

function addDeviceType(type) {
  if (document.getElementById(type))
    return; // check if already exists

  appendNewElement('content',
    '<div id="' + type + '" class="devices-container animate-left">' +
      '<h1>' + type + '</h1>' +
      '<section id="' + type + '-layout" class="devices-layout"/>' +
    '</div>'
  );
  appendNewElement('menu',
    '<button id="' + type + '-menu-button" class="menu-button tablink" onclick="menuTabCallback(\'' + type + '\')">' + type + '</button>'
  );
}

function addDevice(device) {
  if (document.getElementById(device.htmlName))
    return; // check if already exists

  let div = '<div id="' + device.htmlName + '" class="device">';
  div += '<h2>';
  if (device.type !== 'RotationalMotor' && device.type !== 'LinearMotor')
    div += '<input type="checkbox" title="Enable/disable this device." id="' + device.htmlName + '-enable-checkbox" device="' + device.htmlName + '" onclick="checkboxCallback(this)" />';
  div += device.htmlName + '<span id="' + device.htmlName + '-label"></span></h2>';
  if (device.type === 'Camera' && device.recognition === 1) {
    if (device.segmentation === 1) {
      div += '<div class="device-option-enable-label">';
      div += '<h2 class="device-option-item-enable-label">';
    } else
      div += '<h2 class="device-option-enable-label">';
    div += '<input type="checkbox" title="Enable/disable the recognition functionality." id="' + device.htmlName + '-recognition-checkbox" device="' + device.htmlName + '" onclick="cameraRecognitionCheckboxCallback(this)"/>';
    div += '<span>Recognition</span>';
    div += '</h2>';
    if (device.segmentation === 1) {
      div += '<h2 class="device-option-item-enable-label">';
      div += '<input type="checkbox" title="Enable/disable the segmentation functionality." id="' + device.htmlName + '-segmentation-checkbox" device="' + device.htmlName + '" onclick="cameraSegmentationCheckboxCallback(this)" disabled/>';
      div += '<span>Segmentation</span>';
      div += '</h2>';
      div += '</div>';
    }
  } else if (device.type === 'Lidar') {
    div += '<h2 class="device-option-enable-label">';
    div += '<input type="checkbox" title="Enable/disable the lidar point cloud." id="' + device.htmlName + '-cloud-point-checkbox" device="' + device.htmlName + '" onclick="pointCloudCheckboxCallback(this)"/>';
    div += '<span>Point Cloud</span>';
    div += '</h2>';
  }
  div += '<div id="' + device.htmlName + '-content" class="device-content"/>';
  div += '</div>';

  appendNewElement(device.type + '-layout', div);

  if (device.type === 'Accelerometer')
    createGeneric3DDevice(device, TimeplotWidget.prototype.AutoRangeType.STRETCH, -20.0, 20.0, '[m/s^2]');
  else if (device.type === 'Camera')
    createGenericImageDevice(device);
  else if (device.type === 'Compass')
    createGeneric3DDevice(device, TimeplotWidget.prototype.AutoRangeType.NONE, -1.0, 1.0, '');
  else if (device.type === 'DistanceSensor')
    createGeneric1DDevice(device, TimeplotWidget.prototype.AutoRangeType.NONE, device.minValue, device.maxValue, 'Raw');
  else if (device.type === 'GPS')
    createGeneric3DDevice(device, TimeplotWidget.prototype.AutoRangeType.STRETCH, -1.0, 1.0, '[m]');
  else if (device.type === 'Gyro')
    createGeneric3DDevice(device, TimeplotWidget.prototype.AutoRangeType.STRETCH, -20.0, 20.0, '[rad/s]');
  else if (device.type === 'InertialUnit')
    createGeneric3DDevice(device, TimeplotWidget.prototype.AutoRangeType.NONE, -Math.PI, Math.PI, '[rad]');
  else if (device.type === 'Lidar')
    createGenericImageDevice(device);
  else if (device.type === 'LightSensor')
    createGeneric1DDevice(device, TimeplotWidget.prototype.AutoRangeType.STRETCH, 0, 1024, 'Raw');
  else if (device.type === 'PositionSensor')
    createGeneric1DDevice(device, TimeplotWidget.prototype.AutoRangeType.JUMP, -Math.PI, Math.PI, 'Angle [Rad]');
  else if (device.type === 'Radar')
    createRadar(device);
  else if (device.type === 'RangeFinder')
    createGenericImageDevice(device);
  else if (device.type === 'RotationalMotor' || device.type === 'LinearMotor') {
    let minPosition = device.minPosition;
    let maxPosition = device.maxPosition;
    let autoRange = TimeplotWidget.prototype.AutoRangeType.NONE;
    if (minPosition === 0.0 && maxPosition === 0.0) {
      minPosition = device.type === 'RotationalMotor' ? -Math.PI : -1.0;
      maxPosition = device.type === 'RotationalMotor' ? Math.PI : 1.0;
      autoRange = device.type === 'RotationalMotor' ? TimeplotWidget.prototype.AutoRangeType.JUMP : TimeplotWidget.prototype.AutoRangeType.STRETCH;
    }
    createMotor(device, autoRange, minPosition, maxPosition, device.type === 'RotationalMotor' ? 'Angle [rad]' : 'Distance [m]');
  } else if (device.type === 'TouchSensor') {
    if (device.sensorType === 'force-3d')
      createGeneric3DDevice(device, TimeplotWidget.prototype.AutoRangeType.STRETCH, -100.0, 100.0, '[N]');
    else if (device.sensorType === 'force')
      createGeneric1DDevice(device, TimeplotWidget.prototype.AutoRangeType.STRETCH, 0, 20.0, 'Raw');
    else // bumper
      createGeneric1DDevice(device, TimeplotWidget.prototype.AutoRangeType.STRETCH, 0, 1.0, 'Raw');
  }
}

function createGenericImageDevice(device) {
  images[device.name] = appendNewElement(device.name + '-content', '<div id="' + device.htmlName + '-image" class="image"></div>');
}

function createGeneric1DDevice(device, autoRange, minY, maxY, labelY) {
  const widget = new TimeplotWidget(document.getElementById(device.name + '-content'), basicTimeStep, autoRange, {'min': minY, 'max': maxY}, {'x': 'Time [s]', 'y': labelY}, device);
  widget.setLabel(document.getElementById(device.name + '-label'));
  widgets[device.name] = [widget];
}

function createGeneric3DDevice(device, autoRange, minRange, maxRange, units) {
  appendNewElement(device.name,
    '<select onChange="comboboxCallback(this)" class="view-selector" device="' + device.htmlName + '">' +
    '  <option>Time</option>' +
    '  <option>XY</option>' +
    '  <option>YZ</option>' +
    '  <option>XZ</option>' +
    '</select>'
  );
  const plotAutoRange = autoRange !== TimeplotWidget.prototype.AutoRangeType.NONE;

  const widgetTime = new TimeplotWidget(document.getElementById(device.name + '-content'), basicTimeStep, autoRange, {'min': minRange, 'max': maxRange}, {'x': 'Time [s]', 'y': 'Raw'}, device);
  widgetTime.setLabel(document.getElementById(device.name + '-label'));
  const widgetXY = new PlotWidget(document.getElementById(device.name + '-content'), plotAutoRange, {'x': 0, 'y': 1}, {'min': minRange, 'max': maxRange}, {'min': minRange, 'max': maxRange}, {'x': 'x ' + units, 'y': 'y ' + units}, device);
  const widgetYZ = new PlotWidget(document.getElementById(device.name + '-content'), plotAutoRange, {'x': 1, 'y': 2}, {'min': minRange, 'max': maxRange}, {'min': minRange, 'max': maxRange}, {'x': 'y ' + units, 'y': 'z ' + units}, device);
  const widgetXZ = new PlotWidget(document.getElementById(device.name + '-content'), plotAutoRange, {'x': 0, 'y': 2}, {'min': minRange, 'max': maxRange}, {'min': minRange, 'max': maxRange}, {'x': 'x ' + units, 'y': 'z ' + units}, device);

  widgetXY.show(false);
  widgetYZ.show(false);
  widgetXZ.show(false);

  widgets[device.name] = [widgetTime, widgetXY, widgetYZ, widgetXZ];
}

function createRadar(device) {
  const widget = new RadarWidget(document.getElementById(device.name + '-content'), device);
  widgets[device.name] = [widget];
}

function createMotor(device, autoRange, minValue, maxValue, yLabel) {
  let customStyle = '';
  if (navigator.appVersion.indexOf('Linux') !== -1)
    customStyle = ' style="width:17px;"';
  const mean = 0.5 * (maxValue + minValue);
  const step = 0.01 * (maxValue - minValue); // 1%
  const slider = appendNewElement(device.name + '-content',
    '<input type="range" min="' + minValue + '" max="' + maxValue + '" value="' + mean + '" step="' + step + '"' +
    ' class="motor-slider"' + customStyle +
    ' id="' + device.htmlName + '-slider"' +
    ' device="' + device.htmlName + '"' +
    '>');
  slider.oninput = function() { motorSetPosition(device.name, slider.value); };
  slider.onmousedown = function() { motorSetPosition(device.name, slider.value); };
  slider.onmouseup = function() { motorUnsetPosition(device.name); };
  slider.onmouseleave = function() { motorUnsetPosition(device.name); };
  const widget = new TimeplotWidget(document.getElementById(device.name + '-content'), basicTimeStep, autoRange, {'min': minValue, 'max': maxValue}, {'x': 'Time [s]', 'y': yLabel}, device);
  widget.setLabel(document.getElementById(device.name + '-label'));
  widget.setSlider(slider);
  widgets[device.name] = [widget];
}

// Protect all the character instances in the string by prefixing a '\' character.
function protect(str, chars) {
  let protectedStr = str;
  for (let c = 0; c < chars.length; c++) {
    const char = chars[c];
    protectedStr = protectedStr.replace(new RegExp(char, 'g'), '\\' + char);
  }
  return protectedStr;
}

function alphabetical(a, b) {
  const A = a.toLowerCase();
  const B = b.toLowerCase();
  if (A < B)
    return -1;
  else if (A > B)
    return 1;
  else
    return 0;
}

function configure(data) {
  robotName = data.name;
  basicTimeStep = data.basicTimeStep;

  window.robotWindow.setTitle('Generic robot window [' + robotName + ']');

  if (data.devices == null) {
    document.getElementById('no-controller-label').innerHTML = 'No devices.';
    closeMenu();
    return;
  }

  // Parse the devices once to prepare de device type list.
  let deviceTypes = [];
  data.devices.forEach(function(device) {
    if (supportedDeviceTypes.indexOf(device.type) >= 0 && deviceTypes.indexOf(device.type) < 0)
      deviceTypes.push(device.type);
  });

  // Sort the deviceTypes alphabetically.
  deviceTypes.sort(alphabetical);

  // Create a device type container per device types.
  deviceTypes.forEach(function(deviceType) {
    addDeviceType(deviceType);
  });

  // Create a device container per device.
  data.devices.forEach(function(device) {
    if (supportedDeviceTypes.indexOf(device.type) >= 0) {
      device.htmlName = device.name;
      device.name = device.name.replace(/&quot;/g, '"');
      device.model = device.model.replace(/&quot;/g, '"');
      addDevice(device);
    }
  });

  // Set the focus on the first deviceType menu.
  if (deviceTypes.length > 0) {
    menuTabCallback(deviceTypes[0]);
    openMenu();
    document.getElementById('no-controller-label').style.display = 'none';
  } else {
    document.getElementById('no-controller-label').innerHTML = 'No devices supported in the robot window.';
    closeMenu();
  }
}

function applyToUntouchedCheckbox(checkbox, state) {
  const checkboxIndex = touchedCheckboxes.indexOf(checkbox);
  if (checkboxIndex >= 0)
    touchedCheckboxes.splice(checkboxIndex, 1);
  else
    checkbox.checked = state;
}

function update(data) {
  if (data.devices == null)
    return;
  Object.keys(data.devices).forEach(function(key) {
    const value = data.devices[key];
    key = key.replace(/&quot;/g, '"');

    const checkbox = document.getElementById(key + '-enable-checkbox');

    if (value.update !== undefined && key in widgets) {
      widgets[key].forEach(function(widget) {
        value.update.forEach(function(u) {
          widget.addValue({'x': u.time, 'y': u.value });
        });
        widget.refresh();
      });
      if (checkbox && value.update.length > 0)
        applyToUntouchedCheckbox(checkbox, true);
    } else if (value.image && key in images) {
      images[key].style.backgroundImage = 'url("' + value.image + '")';
      if (checkbox)
        applyToUntouchedCheckbox(checkbox, true);
      if (value.cloudPointEnabled !== undefined) {
        const cloudPointCheckbox = document.getElementById(key + '-cloud-point-checkbox');
        applyToUntouchedCheckbox(cloudPointCheckbox, value.cloudPointEnabled);
      }
      if (value.recognitionEnabled !== undefined) {
        const recognitionCheckbox = document.getElementById(key + '-recognition-checkbox');
        applyToUntouchedCheckbox(recognitionCheckbox, value.recognitionEnabled);
        const segmentationCheckbox = document.getElementById(key + '-segmentation-checkbox');
        if (segmentationCheckbox)
          segmentationCheckbox.disabled = !value.recognitionEnabled;
      }
      if (value.segmentationEnabled !== undefined) {
        const segmentationCheckbox = document.getElementById(key + '-segmentation-checkbox');
        applyToUntouchedCheckbox(segmentationCheckbox, value.segmentationEnabled);
      }
    } else if (value.targets !== undefined && key in widgets) {
      widgets[key][0].refreshTargets(value.targets);
      if (checkbox && value.targets.length > 0)
        applyToUntouchedCheckbox(checkbox, true);
    }
  });
}

function receive(message, _robot) {
  let data = '';
  if (message.indexOf('configure ') === 0) {
    try {
      data = JSON.parse(message.substring(10));
    } catch (e) {
      console.log('C to JS protocol error:');
      console.log(e);
      console.log(message);
    }
    if (data)
      configure(data);
  } else if (message.indexOf('update ') === 0) {
    try {
      data = JSON.parse(message.substring(7));
    } catch (e) {
      console.log('C to JS protocol error:');
      console.log(e);
      console.log(message);
    }
    if (data)
      update(data);
  } else
    console.log("Unexpected message received: '" + message + "'");

  Object.keys(motorCommands).forEach(function(deviceName) {
    commands.push(protect(deviceName, [':', ',']) + ':position=' + motorCommands[deviceName]);
  });

  if (Object.keys(commands).length !== 0) {
    window.robotWindow.send(commands.join());
    commands = [];
  }
}

window.onload = function() {
  // get .device-content { with: XXXpx; height: XXXpx; }
  const tmp = document.createElement('div');
  tmp.classList.add('device-content');
  document.body.appendChild(tmp);
  const deviceContentWidth = window.getComputedStyle(document.body.lastChild).getPropertyValue('width').replace(/px$/g, '');
  const deviceContentHeight = window.getComputedStyle(document.body.lastChild).getPropertyValue('height').replace(/px$/g, '');
  document.body.removeChild(document.body.lastChild);

  window.robotWindow = webots.window();
  window.robotWindow.setTitle('Generic robot window');
  window.robotWindow.receive = receive;
  window.robotWindow.send('configure { "imageMaxWidth": ' + deviceContentWidth + ', "imageMaxHeight": ' + deviceContentHeight + ' }');
};
