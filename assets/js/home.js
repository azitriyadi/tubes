// EcoRecycle Landing Page Logic

function calculateEcoEstimate() {
    const categorySelect = document.getElementById('estimator-category');
    const weightInput = document.getElementById('estimator-weight');
    const resultCard = document.getElementById('estimator-result-card');

    if (!weightInput || !categorySelect || !resultCard) return;

    const weight = parseFloat(weightInput.value);
    if (isNaN(weight) || weight <= 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Berat Tidak Valid',
            text: 'Silakan masukkan berat sampah elektronik yang valid (lebih besar dari 0 KG).',
            confirmButtonColor: '#10b981'
        });
        return;
    }

    const baseReward = parseInt(categorySelect.value);
    const totalEstimate = weight * baseReward;
    
    // Estimasi karbon terselamatkan: 1 KG e-waste = 2.5 KG CO2 dicegah
    const co2Saved = (weight * 2.5).toFixed(1);

    // Dapatkan nama kategori bersih (tanpa detail kurung)
    const rawText = categorySelect.options[categorySelect.selectedIndex].text;
    const categoryName = rawText.split(' (')[0];

    // Tentukan tingkatan Eco-Contribution Status berdasarkan berat
    let ecoStatus = "Eco Warrior";
    if (weight >= 15) {
        ecoStatus = "Emerald Hero 🌟";
    } else if (weight >= 5) {
        ecoStatus = "Silver Guardian 🛡️";
    }

    // Format Rupiah
    const formatter = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    });

    // Update DOM
    document.getElementById('result-category-label').innerText = categoryName;
    document.getElementById('result-reward-val').innerText = formatter.format(totalEstimate);
    document.getElementById('result-carbon-val').innerText = co2Saved;
    document.getElementById('result-contribution-status').innerText = ecoStatus;

    // Tampilkan Card Hasil
    resultCard.style.display = 'block';
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
