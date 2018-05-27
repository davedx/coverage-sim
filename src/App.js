/**
* Start with a plane and get basics working. Make drones wrap around at the edges.
* If we want to simulate poles, make it a squashed flat circle instead.
*/

import React, { Component } from 'react'
import * as THREE from 'three'
import './App.css'

const drones = []
const explored = {}
let scene, mars
let exploredHectares = 0
let hours = 0

const droneMat = new THREE.MeshBasicMaterial( {color: 0x000040} )

const rho = 3395 // altitude

const circumference = 213440 // of Mars

let lastkey = ''

const plotLine = (grid, type, x0, y0, x1, y1, limits) => {
  var dx =  Math.abs(x1-x0), sx = x0<x1 ? 1 : -1;
  var dy = -Math.abs(y1-y0), sy = y0<y1 ? 1 : -1; 
  var err = dx+dy, e2; /* error value e_xy */
 
  for (;;) {  /* loop */
    const key = `${x0},${y0}`
    lastkey = key
    if (!grid[key]) {
      grid[key] = type
      exploredHectares += 1
    }
    if (x0==x1 && y0==y1) break;
    e2 = 2*err;
    if (e2 >= dy) { err += dy; x0 += sx; } /* e_xy+e_x > 0 */
    if (e2 <= dx) { err += dx; y0 += sy; } /* e_xy+e_y < 0 */
  }
}

const setPositionFromLatLon = (drone) => {
  if (!drone._data) {
    return
  }
  drone.position.x = drone._data.lon //Math.cos(drone._data.lat) * Math.sin(drone._data.lon) * rho
  drone.position.y = drone._data.lat // Math.cos(drone._data.lat) * Math.cos(drone._data.lon) * rho
  //drone.position.y = -Math.sin(drone._data.lat) * rho
  //console.log('pos: ', drone.position)
}

const addDrone = ({ lat, lon }) => {
  const geometry = new THREE.SphereGeometry( 1000, 4, 4 )
  const sphere = new THREE.Mesh( geometry, droneMat )

  sphere._data = {lat: lat, lon: lon, oldLat: lat, oldLon: lon}
  setPositionFromLatLon(sphere)

  scene.add( sphere )
  drones.push( sphere )
}

const updateDrone = idx => {
  const windSpeed = 30 * 10 // km/h - average wind speed up Mars year round
  const DT = 1 // 1 hour per tick
  const lonDelta = DT * windSpeed

  const data = drones[idx]._data
  data.lon += lonDelta

  const latWindSpeed = 10 * 10
  let latInit = latWindSpeed*0.5

  const y0 = -halfCircum*0.5
  const y1 = halfCircum*0.5

  if (data.lat < y0 + 5000) {
    latInit = latWindSpeed
  } else if (data.lat > y1 - 5000) {
    latInit = 0
  }
  data.lat += (latInit - Math.random()*latWindSpeed)

  setPositionFromLatLon(drones[idx])

  plotLine(explored, true, ~~data.lon, ~~data.lat, ~~data.oldLon, ~~data.oldLat)

  const halfCircum = circumference/2
  const limits = {
    x0: -halfCircum, x1: halfCircum, y0: -halfCircum*0.5, y1: halfCircum*0.5
  }

  if (data.lon < limits.x0) { data.lon = limits.x1 }
  else if (data.lon > limits.x1) { data.lon = limits.x0 }

  if (data.lat < limits.y0) { data.lat = limits.y1 }
  else if (data.lat > limits.y1) { data.lat = limits.y0 }

  data.oldLon = data.lon
  data.oldLat = data.lat
}

const initialize = () => {
  var container
  var camera, renderer
  var clock = new THREE.Clock()

  init()
  animate()

  function init() {
    container = document.getElementById( 'container' )
    const width = window.innerWidth - 300
    const height = window.innerHeight - 60
    camera = new THREE.PerspectiveCamera( 60, width / height, 1, 200000 )
    scene = new THREE.Scene()
    scene.background = new THREE.Color( 0xbfd1e5 )
    camera.position.z = 110000

    const textureLoader = new THREE.TextureLoader()
    const texture = textureLoader.load( "./2k_mars.jpg" );
    const material = new THREE.MeshBasicMaterial({ map : texture });

    const geometry = new THREE.PlaneGeometry( circumference, circumference/2, 16 )
    mars = new THREE.Mesh( geometry, material )
    mars.material.side = THREE.DoubleSide

    scene.add( mars )

    renderer = new THREE.WebGLRenderer()
    renderer.setPixelRatio( window.devicePixelRatio )
    renderer.setSize( width, height )
    container.appendChild( renderer.domElement )
    
    window.addEventListener( 'resize', onWindowResize, false )
  }

  function onWindowResize() {
    const width = window.innerWidth - 300
    const height = window.innerHeight - 60
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize( width, height )
  }

  function animate() {
    requestAnimationFrame( animate )
//    mars.rotateOnAxis(new THREE.Vector3(0, 1, 0), 0.001)
    for (let i=0; i<drones.length; i++) {
      updateDrone(i)
    }
    if (drones.length > 0) {
      hours++
    }
    render()
  }

  function render() {
    renderer.render( scene, camera )
  }
}

class World extends Component {
  componentDidMount() {
    console.log('mounting...')
    initialize()
  }

  render() {
    return <div id='container' className='world'></div>
  }
}

const deployDrones = e => {
  const halfCircum = circumference/2
  const y0 = -halfCircum*0.5
  const y1 = halfCircum*0.5
  const numDrones = 10
  const inc = (y1-y0) / numDrones
  for (let lat = y0; lat <= y1; lat += inc) {
    addDrone({
      lat: lat, lon: 0
    })
  }
}

const Controls = props => {
  const perc = (100 * ((props.exploredHectares/100) / 144800000)).toFixed(2)
  const days = ~~(props.hours/24)

  const mem = window.performance.memory

  return <div className='controls'>
    <h3>Controls</h3>
    <div>
      <label>Area per photograph</label>
      <input id='area' value={props.area} onChange={e => props.onChange(e)} />
    </div>
    <div>
      <h4>Results</h4>
      <p>Explored: {props.exploredHectares/100} / 144.8 million km² = {perc}%</p>
      <p>Elapsed: {days} days</p>
      <p>Memory: {(mem.usedJSHeapSize / 1024).toFixed(1)} / {(mem.totalJSHeapSize / 1024).toFixed(1)} kB used</p>
    </div>
    <button onClick={e => deployDrones(e)}>Deploy drones</button>
  </div>
}

class App extends Component {
  constructor() {
    super()

    this.state = {
      area: 1,
      hours: 0,
      exploredHectares: 0
    }

    this.onChange = this.onChange.bind(this) // ffs, it's 2018

    setInterval(() => {
      this.setState({
        exploredHectares: exploredHectares,
        hours: hours,
        lastkey: lastkey
      })
    }, 500)
  }

  onChange(e) {
    console.log('onChange: ', e.target.value, e.target.id)
    this.setState({
      [e.target.id]: e.target.value
    })
  }

  render() {
    const state = {
      ...this.state,
      onChange: this.onChange
    }

    return (
      <div className='sim'>
        <div className='sim-top'>
          <h3>Survey Coverage Simulator</h3>
          <a className='sim-code' href='https://github.com/davedx/mars-power'>Source code</a>
        </div>
        <Controls {...state} />
        <World />
      </div>
    )
  }
}

export default App
