document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.getElementById("customers-body");
  const modal = document.getElementById("block-modal");
  const modalText = document.getElementById("block-modal-text");
  const reasonInput = document.getElementById("block-reason");
  const cancelBtn = document.getElementById("block-cancel");
  const confirmBtn = document.getElementById("block-confirm");

  let currentCustomer = null;

  function formatDate(d) {
    if (!d) return "-";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-BR");
  }

  function openModal(customer) {
    currentCustomer = customer;
    modalText.textContent = `${customer.name || ""} (${customer.phone})`;
    reasonInput.value = "";
    modal.classList.remove("hidden");
  }

  function closeModal() {
    currentCustomer = null;
    modal.classList.add("hidden");
  }

  cancelBtn.addEventListener("click", closeModal);

  confirmBtn.addEventListener("click", async () => {
    if (!currentCustomer) return;
    const reason = reasonInput.value.trim() || "Bloqueado via painel";

    confirmBtn.disabled = true;
    try {
      await window.blockCustomer(currentCustomer.id, reason);
      await loadCustomers(); // recarrega tabela
    } catch (err) {
      console.error(err);
      alert("Erro ao bloquear cliente.");
    } finally {
      confirmBtn.disabled = false;
      closeModal();
    }
  });

  async function deleteCustomerHandler(customer) {
    if (!confirm(`Tem certeza que deseja excluir ${customer.name || customer.phone}?\n\nEsta ação não pode ser desfeita!`)) {
      return;
    }

    try {
      await window.deleteCustomer(customer.id);
      alert("Cliente excluído com sucesso!");
      await loadCustomers();
    } catch (err) {
      console.error(err);
      alert(err.message || "Erro ao excluir cliente.");
    }
  }

  async function loadCustomers() {
    tbody.innerHTML = "<tr><td colspan='6'>Carregando...</td></tr>";
    try {
      const customers = await window.getCustomers();
      tbody.innerHTML = "";

      if (!customers.length) {
        tbody.innerHTML = "<tr><td colspan='6'>Nenhum cliente encontrado.</td></tr>";
        return;
      }

      for (const c of customers) {
        const tr = document.createElement("tr");

        const tdName = document.createElement("td");
        tdName.textContent = c.name || "-";
        tr.appendChild(tdName);

        const tdPhone = document.createElement("td");
        tdPhone.textContent = c.phone;
        tr.appendChild(tdPhone);

        const tdCount = document.createElement("td");
        tdCount.textContent = c.total_appointments || 0;
        tr.appendChild(tdCount);

        const tdLast = document.createElement("td");
        tdLast.textContent = formatDate(c.last_appointment_date);
        tr.appendChild(tdLast);

        const tdStatus = document.createElement("td");
        const badge = document.createElement("span");
        badge.textContent = c.is_blocked ? "Bloqueado" : "Ativo";
        badge.className = c.is_blocked ? "badge badge-danger" : "badge badge-success";
        tdStatus.appendChild(badge);
        tr.appendChild(tdStatus);

        const tdActions = document.createElement("td");
        tdActions.style.display = "flex";
        tdActions.style.gap = "0.5rem";
        
        // Botão Bloquear/Desbloquear
        const btnBlock = document.createElement("button");
        if (c.is_blocked) {
          btnBlock.textContent = "Desbloquear";
          btnBlock.className = "btn";
          btnBlock.addEventListener("click", async () => {
            try {
              await window.unblockCustomer(c.id);
              await loadCustomers();
            } catch (err) {
              console.error(err);
              alert("Erro ao desbloquear cliente.");
            }
          });
        } else {
          btnBlock.textContent = "Bloquear";
          btnBlock.className = "btn btn-danger";
          btnBlock.addEventListener("click", () => openModal(c));
        }
        tdActions.appendChild(btnBlock);

        // Botão Excluir
        const btnDelete = document.createElement("button");
        btnDelete.textContent = "Excluir";
        btnDelete.className = "btn btn-danger";
        btnDelete.style.background = "#dc3545";
        btnDelete.addEventListener("click", () => deleteCustomerHandler(c));
        tdActions.appendChild(btnDelete);

        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      }
    } catch (err) {
      console.error(err);
      tbody.innerHTML = "<tr><td colspan='6'>Erro ao carregar clientes.</td></tr>";
    }
  }

  loadCustomers();
});