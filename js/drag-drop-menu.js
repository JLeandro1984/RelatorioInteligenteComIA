/**
 * Módulo de Drag-and-Drop para Menu Lateral
 * Permite reordenar relatórios de forma personalizada e salva no LocalStorage
 */

const DragDropMenu = (function() {
  'use strict';

  const STORAGE_KEY = 'relatorio_menu_order';
  let draggedElement = null;
  let draggedOverElement = null;

  /**
   * Inicializa o drag-and-drop no menu
   */
  function init(menuSelector = '#sidebarMenu') {
    const menu = document.querySelector(menuSelector);
    if (!menu) return;

    attachEventListeners(menu);
    restoreMenuOrder(menu);
  }

  /**
   * Anexa listeners de drag-and-drop aos items
   */
  function attachEventListeners(menu) {
    menu.addEventListener('dragstart', handleDragStart);
    menu.addEventListener('dragend', handleDragEnd);
    menu.addEventListener('dragover', handleDragOver);
    menu.addEventListener('drop', handleDrop);
    menu.addEventListener('dragenter', handleDragEnter);
    menu.addEventListener('dragleave', handleDragLeave);

    // Marcar todos os items como draggable
    menu.querySelectorAll('.menu-item').forEach(item => {
      item.draggable = true;
      item.style.cursor = 'grab';
    });
  }

  /**
   * Inicia o arrasto
   */
  function handleDragStart(e) {
    draggedElement = e.target.closest('.menu-item');
    if (!draggedElement) return;

    draggedElement.style.cursor = 'grabbing';
    draggedElement.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', draggedElement.innerHTML);

    // Criar imagem de arraste customizada
    const dragImage = draggedElement.cloneNode(true);
    dragImage.style.opacity = '0.8';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => dragImage.remove(), 0);
  }

  /**
   * Finaliza o arrasto
   */
  function handleDragEnd(e) {
    const menu = e.target.closest('.menu-item')?.parentElement;
    if (menu) {
      menu.querySelectorAll('.menu-item').forEach(item => {
        item.style.opacity = '1';
        item.style.cursor = 'grab';
        item.classList.remove('drag--over');
        item.classList.remove('drag--over-top');
        item.classList.remove('drag--over-bottom');
      });
    }
    draggedElement = null;
    draggedOverElement = null;
  }

  /**
   * Permite o drop (drag over)
   */
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  /**
   * Detecta quando entra em outro item
   */
  function handleDragEnter(e) {
    const target = e.target.closest('.menu-item');
    if (target && target !== draggedElement) {
      draggedOverElement = target;
      target.classList.add('drag--over');

      // Determinar se é para cima ou para baixo
      const rect = target.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (e.clientY < midpoint) {
        target.classList.remove('drag--over-bottom');
        target.classList.add('drag--over-top');
      } else {
        target.classList.remove('drag--over-top');
        target.classList.add('drag--over-bottom');
      }
    }
  }

  /**
   * Remove feedback visual ao sair de um item
   */
  function handleDragLeave(e) {
    const target = e.target.closest('.menu-item');
    if (target) {
      target.classList.remove('drag--over');
      target.classList.remove('drag--over-top');
      target.classList.remove('drag--over-bottom');
    }
  }

  /**
   * Processa o drop (reordenação)
   */
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedElement || !draggedOverElement || draggedElement === draggedOverElement) {
      return false;
    }

    const menu = draggedElement.parentElement;
    const rect = draggedOverElement.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (e.clientY < midpoint) {
      draggedOverElement.parentElement.insertBefore(draggedElement, draggedOverElement);
    } else {
      draggedOverElement.parentElement.insertBefore(draggedElement, draggedOverElement.nextSibling);
    }

    // Salvar nova ordem
    saveMenuOrder(menu);

    return false;
  }

  /**
   * Salva a ordem dos items no LocalStorage
   */
  function saveMenuOrder(menu) {
    const order = Array.from(menu.querySelectorAll('.menu-item'))
      .map(item => item.dataset.report);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }

  /**
   * Restaura a ordem salva do LocalStorage
   */
  function restoreMenuOrder(menu) {
    const savedOrder = localStorage.getItem(STORAGE_KEY);
    if (!savedOrder) return;

    try {
      const order = JSON.parse(savedOrder);
      const items = Array.from(menu.querySelectorAll('.menu-item'));

      // Criar mapa de items
      const itemMap = new Map(items.map(item => [item.dataset.report, item]));

      // Reordenar conforme salvo
      order.forEach(reportKey => {
        const item = itemMap.get(reportKey);
        if (item) {
          menu.appendChild(item);
        }
      });
    } catch (err) {
      console.warn('Erro ao restaurar ordem do menu:', err);
    }
  }

  /**
   * Limpar a ordem salva (resetar para padrão)
   */
  function resetMenuOrder() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  /**
   * Obter a ordem atual
   */
  function getCurrentOrder() {
    const menu = document.querySelector('#sidebarMenu');
    if (!menu) return [];
    return Array.from(menu.querySelectorAll('.menu-item'))
      .map(item => item.dataset.report);
  }

  // API Pública
  return {
    init,
    resetMenuOrder,
    getCurrentOrder
  };

})();
