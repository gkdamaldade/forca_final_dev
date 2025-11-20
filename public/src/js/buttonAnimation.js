// Script para animação de completar palavra nos botões
document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.login-button[data-text-full]');
  
  buttons.forEach(button => {
    const textFull = button.getAttribute('data-text-full');
    const textShort = button.getAttribute('data-text-short');
    const buttonText = button.querySelector('.button-text');
    
    if (!buttonText) return;
    
    // Garante que o texto inicial seja o abreviado
    if (buttonText.textContent !== textShort) {
      buttonText.textContent = textShort;
    }
    
    // Cria elemento para o texto completo
    const fullTextSpan = document.createElement('span');
    fullTextSpan.className = 'button-text-full';
    fullTextSpan.textContent = textFull;
    fullTextSpan.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 0;
      overflow: hidden;
      white-space: nowrap;
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      color: white;
      text-shadow: 
        0 0 10px rgba(255, 255, 255, 0.5),
        0 0 20px rgba(0, 229, 255, 0.3);
    `;
    
    button.style.position = 'relative';
    button.appendChild(fullTextSpan);
    
    // Hover: completa a palavra
    button.addEventListener('mouseenter', () => {
      buttonText.style.opacity = '0';
      fullTextSpan.style.width = '100%';
    });
    
    // Mouse out: volta ao abreviado
    button.addEventListener('mouseleave', () => {
      buttonText.style.opacity = '1';
      fullTextSpan.style.width = '0';
    });
  });
});

