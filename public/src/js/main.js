document.addEventListener("DOMContentLoaded", function()
  {
      const btnCadastro = document.getElementById("btnCadastro");
      if(btnCadastro){
        btnCadastro.addEventListener("click", function(){
          window.location.href = "cadastro.html";
        });
      }
      const btnLogin = document.getElementById("btnLogin");
      if(btnLogin){
         btnLogin.addEventListener("click", function(){
          window.location.href = "login.html";
         });
      }
  });
        
                            



