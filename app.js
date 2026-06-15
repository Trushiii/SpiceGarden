const variants = [
    "A sensory journey of charred spices and succulent chicken.",
    "A health-conscious choice, perfectly grilled and packed with protein."
];
const selectedDesc = variants[Math.floor(Math.random() * variants.length)];
document.getElementById('dish-desc').innerText = selectedDesc;

function addToCart() {
    document.getElementById('notification').style.display = 'block';
    setTimeout(() => { document.getElementById('notification').style.display = 'none'; }, 2000);
    
    // Log behavioral data
    fetch('/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'add_to_cart', variant: selectedDesc })
    });
    
    // Show survey after interaction
    document.getElementById('survey-modal').style.display = 'block';
}

function submitSurvey() {
    const rating = document.getElementById('likert').value;
    fetch('/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'survey', rating: rating })
    });
    alert('Thank you!');
    location.reload();
}

// Add this logic to your app.js
document.addEventListener('DOMContentLoaded', () => {
    // Menu logic
    const menuItems = [
        { name: "Hot Butter Cuttlefish", desc: "Crispy cuttlefish tossed in spicy butter sauce", price: "LKR 1800" },
        { name: "Seafood Fried Rice", desc: "Wok-fried rice with prawns, fish & cuttlefish", price: "LKR 1500" }
    ];

    const container = document.getElementById('menu-container');
    if (container) {
        menuItems.forEach(item => {
            container.innerHTML += `
                <div class="card">
                    <h3>${item.name}</h3>
                    <p>${item.desc}</p>
                    <p><strong>${item.price}</strong></p>
                    <button onclick="logOrder('${item.name}')">Order Now</button>
                </div>
            `;
        });
    }
});

function logOrder(dish) {
    fetch('/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'order', dish: dish, timestamp: new Date() })
    });
    alert('Added to your order!');
}

function handleContact(event) {
    event.preventDefault();
    const data = { action: 'contact_form', name: event.target.name.value, email: event.target.email.value };
    fetch('/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    }).then(() => alert('Message sent!'));
}