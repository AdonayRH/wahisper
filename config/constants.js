module.exports = {
  EMBEDDING_MODEL: "text-embedding-3-small",
  TOP_K_RESULTS: 3,
  // Se utiliza para gestionar el estado de la conversación botStateService.js
  STATES: {
    INITIAL: 'initial',
    SHOWING_PRODUCTS: 'showing_products',
    ASKING_CONFIRMATION: 'asking_confirmation',
    ASKING_QUANTITY: 'asking_quantity',
    ASKING_FOR_MORE: 'asking_for_more',
    ENDING: 'ending',
    WAITING_FOR_FILE: 'waiting_for_file',
    CONFIRMING_INVENTORY: 'confirming_inventory',
    CONFIRMING_REMOVE_ALL: 'confirming_remove_all',
    ASKING_REMOVE_QUANTITY: 'asking_remove_quantity',
    CONFIRMING_REMOVE_ITEM: 'confirming_remove_item',
    REMOVING_ITEM: 'removing_item',
    CONFIRMING_CHECKOUT: 'confirming_checkout',
    CHECKOUT_COMPLETED: 'checkout_completed'
  }
};
