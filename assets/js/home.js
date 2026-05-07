function trackShipment() {
    const input = document.getElementById('track-input');
    const resultMin = document.getElementById('track-result-mini');
    if (input.value.trim() === "") {
        Swal.fire({
            icon: 'warning',
            title: 'Oops...',
            text: 'Mohon masukkan nomor resi yang valid.'
        });
        return;
    }
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
            text: 'Mohon masukkan berat paket yang valid.'
        });
        return;
    }

    const basePrice = parseInt(serviceSelect.value);
    const totalPrice = weight * basePrice;

    const serviceName = serviceSelect.options[serviceSelect.selectedIndex].text.split(' (')[0];
    const eta = serviceSelect.options[serviceSelect.selectedIndex].text.split('(')[1].replace(')', '');

    document.getElementById('result-service-name').innerText = serviceName;
    document.getElementById('result-price').innerText = "Rp " + totalPrice.toLocaleString('id-ID');
    document.getElementById('result-eta').innerText = eta;

    resultCard.style.display = 'block';
}
