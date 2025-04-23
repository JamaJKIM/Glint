import { ipcRenderer } from 'electron';

// Function to show overlay
function showOverlay() {
    console.log('Showing overlay');
    const overlay = document.querySelector('.screenshot-overlay') as HTMLElement;
    if (overlay) {
        // Make sure overlay is visible and interactive
        overlay.style.display = 'block';
        overlay.style.pointerEvents = 'auto';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        
        // Force a reflow to ensure the overlay is visible
        overlay.offsetHeight;
        
        console.log('Overlay shown successfully');
    } else {
        console.error('Overlay element not found');
    }
}

// Function to hide overlay
function hideOverlay() {
    console.log('Hiding overlay');
    const overlay = document.querySelector('.screenshot-overlay') as HTMLElement;
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Screenshot selection variables
let isSelecting = false;
let startX = 0;
let startY = 0;

// Function to update selection box
function updateSelectionBox(e: MouseEvent) {
    const selectionBox = document.querySelector('.selection-box') as HTMLElement;
    if (!selectionBox) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
    selectionBox.style.display = 'block';
}

// Add test button handler
document.getElementById('test-button')?.addEventListener('click', () => {
    console.log('Test button clicked');
    ipcRenderer.send('test-hotkey');
});

// Handle screenshot start event
ipcRenderer.on('start-screenshot', () => {
    console.log('Screenshot event received');
    // Small delay to ensure window is fully focused
    setTimeout(showOverlay, 100);
});

// Add mouse event handlers for screenshot selection
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.querySelector('.screenshot-overlay') as HTMLElement;
    if (!overlay) return;

    overlay.addEventListener('mousedown', (e) => {
        console.log('Mouse down on overlay');
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        const selectionBox = document.querySelector('.selection-box') as HTMLElement;
        if (selectionBox) {
            selectionBox.style.display = 'none';
        }
    });

    overlay.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        updateSelectionBox(e);
    });

    overlay.addEventListener('mouseup', (e) => {
        console.log('Mouse up on overlay');
        if (!isSelecting) return;
        isSelecting = false;
        updateSelectionBox(e);
        
        // Get final selection coordinates
        const selectionBox = document.querySelector('.selection-box') as HTMLElement;
        if (selectionBox) {
            const selection = {
                x: parseInt(selectionBox.style.left),
                y: parseInt(selectionBox.style.top),
                width: parseInt(selectionBox.style.width),
                height: parseInt(selectionBox.style.height)
            };
            console.log('Selection made:', selection);
            // Hide overlay and selection box
            hideOverlay();
            selectionBox.style.display = 'none';
            // Send selection to main process
            ipcRenderer.send('capture-screenshot', selection);
        }
    });
});

// Log when the window gains/loses focus
window.addEventListener('focus', () => {
    console.log('Window gained focus');
});

window.addEventListener('blur', () => {
    console.log('Window lost focus');
}); 