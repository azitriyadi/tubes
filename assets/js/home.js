function trackShipment() {
    const input = document.getElementById('track-input');
    const resultMin = document.getElementById('track-result-mini');
    if (input.value.trim() === "") {
        Swal.fire({
            icon: 'warning',
            title: 'Oops...',
            text: 'Mohon masukkan nomor tracking yang valid.'
        });
        return;
    }
    
    // In actual app, this would call API, here we just show simulation
    resultMin.style.display = 'block';
}

function calculateOngkir() {
    const weightInput = document.getElementById('ongkir-weight');
    const serviceSelect = document.getElementById('ongkir-service');
    const resultCard = document.getElementById('ongkir-result-card');

    const weight = parseFloat(weightInput.value);
    if (isNaN(weight) || weight <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Oops...',
            text: 'Mohon masukkan berat e-waste yang valid.'
        });
        return;
    }

    const baseReward = parseInt(serviceSelect.value);
    const totalReward = weight * baseReward;

    const categoryName = serviceSelect.options[serviceSelect.selectedIndex].text.split(' (')[0];

    document.getElementById('result-service-name').innerText = categoryName;
    document.getElementById('result-price').innerText = "Rp " + totalReward.toLocaleString('id-ID');
    document.getElementById('result-eta').innerText = weight > 5 ? "High Contribution" : "Eco-Friend";

    resultCard.style.display = 'block';
}
