async function switchStrategy(strategy) {
    try {
        const response = await fetch('/api/switch-strategy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strategy: strategy })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(result.message || `Strategy switched to ${strategy}`);
            // Refresh to show updated state
            setTimeout(() => location.reload(), 800);
        } else {
            alert('Failed to switch strategy: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Error switching strategy: ' + error);
    }
}