
// import 생략
// 생략
function App() {
    const divContainer = document.querySelector("#webgl-container");
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding; // sRGB 인코딩 적용
    divContainer.appendChild(renderer.domElement);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // high quality
    renderer.setClearColor(0xb7ecff); // 배경색.
    const scene = new THREE.Scene();
    const clock = new THREE.Clock();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // 우클릭이동
    let camera;
    let AGV_Center_01, tray_01, tray_02;
    let moveQueue = []; // 쉬프트 명령으로 웨이포인트 가능.
    const containerRect = divContainer.getBoundingClientRect(); // 클릭위치 별도로 계산
    let orbitCtrl;
    const raycaster = new THREE.Raycaster();
    let destinationM = null;
    let moveClickMode = false; // m신공.

    setupCamera();
    loadModel();
    setupBackgroundModel();
    setupLight();

    window.addEventListener('keydown', handleKeyDown);
    window.handleKeyDown = handleKeyDown; // html용. 이벤틀 리스너(?)에 등록.
    divContainer.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', resize);
    renderer.domElement.addEventListener('mousedown', handleMouseDown, false);
    renderer.domElement.addEventListener('contextmenu', handleRightClick, false);
    renderer.domElement.addEventListener('touchstart', handleTouchStart, false);
    resize();
    requestAnimationFrame(render);

    function loadModel() {
        const Robot01 = new GLTFLoader();

        Robot01.load('./assets/AGV_Center_01.gltf', (gltf) => {
            AGV_Center_01 = gltf.scene;
            AGV_Center_01.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                }
            });
            scene.add(AGV_Center_01);
            AGV_Center_01.receiveShadow = true;
            AGV_Center_01.castShadow = true;
            attachCameraToAGV(); // 카메라를 AGV에 추가합니다.
            orbitCtrl = setupOrbitControls(); // AGV 로드 후 OrbitControls 설정
        });

        Robot01.load('./assets/tray_01.gltf', (gltf) => {
            tray_01 = gltf.scene;
            tray_01.position.set(-2, 0, -2);
            tray_01.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                }
            });
            setTimeout(() => {
                scene.add(tray_01);
            }, 500);
            tray_01.receiveShadow = true;
            tray_01.castShadow = true;
        });

        Robot01.load('./assets/tray_01.gltf', (gltf) => {
            tray_02 = gltf.scene;
            tray_02.position.set(0, 0, -2);
            tray_02.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                }
            });
            setTimeout(() => {
                scene.add(tray_02);
            }, 500);
            tray_02.receiveShadow = true;
            tray_02.castShadow = true;
        });

        // Robot01.load('./assets/Box_Center.gltf', (gltf) => {
        //     const Box_Center = gltf.scene;
        //     Box_Center.traverse((child) => {
        //         if (child.isMesh) {
        //             child.material.side = THREE.FrontSide; //앞면만
        //         }
        //     });
        //     scene.add(Box_Center);
        // });
    }

    function setupBackgroundModel() {
        new RGBELoader()
        .setDataType(THREE.FloatType) // 해상도보정, 자원 많이먹음.
        .load('./HDR/Warehouse-with-lights.hdr', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
        });

        scene.fog = new THREE.Fog(0xe0e0e0, 50, 80);
        let grid;
        grid = new THREE.GridHelper(100, 100, 0x000000, 0x000000);
        grid.material.opacity = 0.2;
        grid.material.depthWrite = false;
        grid.material.transparent = true;
        scene.add(grid);
        var geometry_btm1 = new THREE.PlaneGeometry(256, 256, 100, 100);
        geometry_btm1.rotateX(- Math.PI / 2);
        const texture_btm1 = new THREE.TextureLoader().load('./image/checkerboard4.png');
        texture_btm1.wrapS = THREE.RepeatWrapping;
        texture_btm1.wrapT = THREE.RepeatWrapping;
        texture_btm1.repeat.set(128, 128);
        var material_btm1 = new THREE.MeshStandardMaterial({
            map: texture_btm1,
            color: 0xf0f0f0,
            roughness: 0.8, //거울 효과는 여기서
            metalness: 0.2, //이건 그냥 밝기조절용
            // side: THREE.DoubleSide // 설정안하면 뒷면은 투명.
        });
        var plane_btm = new THREE.Mesh(geometry_btm1, material_btm1);
        plane_btm.receiveShadow = true;
        scene.add(plane_btm);
    }

    function setupLight() {
        const lightH = new THREE.HemisphereLight(0xB1E1FF, 0xB97A20, 1);
        scene.add(lightH);

        const Directlight1 = new THREE.DirectionalLight(0xffffff, 0.5);
        Directlight1.position.set(-5, 15, 5);
        Directlight1.lookAt(0, 15, 0);// 효과없음. 
        Directlight1.castShadow = true;
        Directlight1.shadow.camera.left = -10;
        Directlight1.shadow.camera.right = 10;
        Directlight1.shadow.camera.top = 20;
        Directlight1.shadow.camera.bottom = -10
        scene.add(Directlight1);
        // const cameraHelper = new THREE.CameraHelper(Directlight1.shadow.camera); 
        // scene.add(cameraHelper); //toggle
    }

    function setupCamera() {
        camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(10, 10, 10);
    }

    function attachCameraToAGV() {
        AGV_Center_01.add(camera); // 카메라를 AGV 객체에 추가합니다.
        camera.position.set(10, 10, 10); // 카메라의 상대 위치를 AGV에 맞춥니다.
    }

    function setupOrbitControls() {
        const orbCtrl = new OrbitControls(camera, divContainer);
        orbCtrl.target.copy(AGV_Center_01.position);
        orbCtrl.target.add(new THREE.Vector3(0, 1, 0)); // 타겟위치 올림
        orbCtrl.update();
        // 마우스 우클릭 드래그 패닝만 비활성화
        orbCtrl.mouseButtons.RIGHT = null;
        return orbCtrl;
    }

    function getIntersects(x, y) {
        const mouseVector = new THREE.Vector2();
        mouseVector.set(((x - containerRect.left) / containerRect.width) * 2 - 1, -((y - containerRect.top) / containerRect.height) * 2 + 1);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouseVector, camera);

        const ray = raycaster.ray;
        const intersectionPoint = new THREE.Vector3();
        ray.intersectPlane(groundPlane, intersectionPoint);

        if (intersectionPoint) {
            return [{ point: intersectionPoint }];
        } else {
            return [];
        }
    }

    function createClickEffect(position) {
        const geometry = new THREE.RingGeometry(0.5, 0.54, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0x44abff, side: THREE.DoubleSide });
        const circle = new THREE.Mesh(geometry, material);
        circle.position.copy(position);
        circle.position.y = 0.01;
        circle.rotation.x = -Math.PI / 2;
        scene.add(circle);
        circle.scale.set(0.1, 0.1, 0.1); // 원의 시작 크기
        const targetScale = new THREE.Vector3(1, 1, 1);
        const animationDuration = 500; // 애니메이션 지속 시간(ms)
        const startTime = performance.now();
        function animateCircle() {
            const elapsedTime = performance.now() - startTime;
            const progress = elapsedTime / animationDuration;
            if (progress < 1) {
                circle.scale.lerpVectors(new THREE.Vector3(0.1, 0.1, 0.1), targetScale, progress);
                requestAnimationFrame(animateCircle);
            }
        }
        animateCircle();
        setTimeout(() => {
            scene.remove(circle);
            material.dispose();
            geometry.dispose();
        }, animationDuration);
    }

    function handleRightClick(event) {
        event.preventDefault(); // 기본 우클릭 메뉴 비활성화
        if (event.button === 2 || (event.button === 0 && moveClickMode)) {
            const intersects = getIntersects(event.clientX, event.clientY);

            if (destinationM) {
                const point = destinationM;
                createClickEffect(point);

                if (event.shiftKey) {
                    moveQueue.push(point);
                } else {
                    TWEEN.removeAll();
                    moveQueue = [point];
                    moveToNextPoint();
                }
            } else {
                if (intersects.length > 0) {
                    const point = intersects[0].point;
                    createClickEffect(point);

                    if (event.shiftKey) {
                        moveQueue.push(point);
                    } else {
                        TWEEN.removeAll();
                        moveQueue = [point];
                        moveToNextPoint();
                    }
                }
            }
        }
    }

    function moveToNextPoint() {
        if (moveQueue.length === 0) {
            return;
        }
        const point = moveQueue.shift();
        const coords = { x: AGV_Center_01.position.x, z: AGV_Center_01.position.z };
        // 거리에 따른 시간 계산
        const distance = AGV_Center_01.position.distanceTo(point);
        const maxSpeed = 2; // 최대 속도 (유닛/초)
        const duration = (distance / maxSpeed) * 1000; // 이동 시간 (밀리초)
        new TWEEN.Tween(coords)
            .to({ x: point.x, z: point.z }, duration)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => {
                AGV_Center_01.position.set(coords.x, AGV_Center_01.position.y, coords.z);
            })
            .onComplete(() => {
                // 이동이 완료되면 다음 명령을 실행합니다.
                moveToNextPoint();
            })
            .start();
    }

    function findNearestTray(agv, maxDistance) {
        const trayList = [tray_01, tray_02];
        let nearestTray = null;
        let minDistance = Number.MAX_VALUE;

        trayList.forEach((tray) => {
            const distance = agv.position.distanceTo(tray.position);
            if (distance < maxDistance && distance < minDistance) {
                nearestTray = tray;
                minDistance = distance;
            }
        });

        return nearestTray;
    }

    function hasTray(agv) {
        const trayList = [tray_01, tray_02];
        return agv.children.some((child) => trayList.includes(child));
    }

    function handleMouseDown(event) {
        if (moveClickMode && event.button === 0) {
            handleRightClick(event);
            moveClickMode = false;
            renderer.domElement.style.cursor = 'default'; // 커서 스타일을 원래대로 돌림
        } else if (event.button === 0 || event.button === 2) {
            moveClickMode = false;
            renderer.domElement.style.cursor = 'default';
        }
    }

    function handleKeyDown(event) {
        if (event.key === 's' || event.key === 'h' || event.key === 'b') {
            TWEEN.removeAll();
            moveQueue = [];
        } else if (event.key === 'm') {
            moveClickMode = true;
            renderer.domElement.style.cursor = 'crosshair'
        }

        if (event.key === 'f') {
            const targetY = 2;
            const coords = { y: AGV_Center_01.position.y };

            new TWEEN.Tween(coords)
                .to({ y: targetY }, 1000)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate(() => {
                    AGV_Center_01.position.setY(coords.y);
                })
                .start();
        } else if (event.key === 'd') {
            const targetY = 0; // original ground level
            const coords = { y: AGV_Center_01.position.y };

            new TWEEN.Tween(coords)
                .to({ y: targetY }, 1000)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate(() => {
                    AGV_Center_01.position.setY(coords.y);
                })
                .start();
        } else if (event.key === 'b') {
            const targetPosition = new THREE.Vector3(0, 0, 0);
            const coords = { x: AGV_Center_01.position.x, y: AGV_Center_01.position.y, z: AGV_Center_01.position.z };

            new TWEEN.Tween(coords)
                .to(targetPosition, 1000)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate(() => {
                    AGV_Center_01.position.set(coords.x, coords.y, coords.z);
                })
                .start();
        }

        if (event.key === 'g') {
            const maxDistance = 2; // 주변 2 미터
            const nearestTray = findNearestTray(AGV_Center_01, maxDistance);

            if (nearestTray && !AGV_Center_01.children.includes(nearestTray) && !hasTray(AGV_Center_01)) {
                nearestTray.position.set(0, 0, 0);
                AGV_Center_01.add(nearestTray);
            }
        } else if (event.key === 'e') {
            const trayList = [tray_01, tray_02];
            const tray = AGV_Center_01.children.find((child) => trayList.includes(child));

            if (tray) {
                const trayWorldPosition = tray.getWorldPosition(new THREE.Vector3());
                tray.position.copy(trayWorldPosition);
                scene.add(tray);
                AGV_Center_01.remove(tray);
            }
        }
        if (['s', 'h', 'f', 'd', 'b', 'g', 'e'].includes(event.key)) {
            moveClickMode = false;
            renderer.domElement.style.cursor = 'default';
        }

    }

    function onMouseMove(event) {
        event.preventDefault();
        const rect = renderer.domElement.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        const mouse = new THREE.Vector2(x, y);
        raycaster.setFromCamera(mouse, camera);
        const intersects1 = raycaster.intersectObjects([tray_01], true);
        const intersects2 = raycaster.intersectObjects([tray_02], true);

        if (moveClickMode) {
            renderer.domElement.style.cursor = 'crosshair';
        } else {
            if (intersects1.length > 0) {
                renderer.domElement.style.cursor = 'pointer';
                destinationM = tray_01.position.clone();
            } else if (intersects2.length > 0) {
                renderer.domElement.style.cursor = 'pointer';
                destinationM = tray_02.position.clone();
            } else {
                renderer.domElement.style.cursor = 'default';
                destinationM = null;
            }
        }
    }

    function handleTouchStart(event) {
        event.preventDefault();

        if (moveClickMode) {
            const touch = event.touches[0] || event.changedTouches[0];

            const touchX = touch.clientX;
            const touchY = touch.clientY;

            handleRightClick({
                clientX: touchX,
                clientY: touchY,
                button: 2, // 우클릭 이벤트를 시뮬레이션하기 위해 button 값을 2로 설정
                preventDefault: () => { } // 빈 함수를 추가하여 오류를 방지합니다.
            });

            moveClickMode = false;
            renderer.domElement.style.cursor = 'default'; // 커서 스타일을 원래대로 돌림
        }
    }

    function update(time) {
        time *= 0.001; // second unit
        if (AGV_Center_01) {
            orbitCtrl.target.copy(AGV_Center_01.position);
            orbitCtrl.target.add(new THREE.Vector3(0, 1, 0)); // 타겟위치 올림
            orbitCtrl.update();
        }
    }

    function render() {
        const time = clock.getElapsedTime();
        renderer.render(scene, camera);
        update(time);
        requestAnimationFrame(render);
    }

    function resize() {
        const width = divContainer.clientWidth;
        const height = divContainer.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
    // Setup the animation loop.
    function animate(time) {
        requestAnimationFrame(animate);
        TWEEN.update(time);
    }
    requestAnimationFrame(animate);
}


window.addEventListener('load', App);

// export { handleKeyDown };

import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/build/three.module.js'; //r115에서 hdr이슈.
import { OrbitControls } from 'https://threejsfundamentals.org/threejs/resources/threejs/r115/examples/jsm/controls/OrbitControls.js'; //r125 m신공 버그
import { GLTFLoader } from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/loaders/RGBELoader.js';
import * as TWEEN from 'https://cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.esm.min.js';

import { GUI } from 'https://threejsfundamentals.org/threejs/../3rdparty/dat.gui.module.js';
