
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Cabeçalhos CORS expandidos para permitir todos os headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Função para log com prefixo
const log = (message: string, data?: any) => {
  const logMessage = data 
    ? `[CUSTOMER-PORTAL] ${message}: ${typeof data === 'object' ? JSON.stringify(data) : data}`
    : `[CUSTOMER-PORTAL] ${message}`;
  console.log(logMessage);
};

serve(async (req) => {
  log(`Requisição recebida - método: ${req.method}`);
  
  // Lidar com requisições OPTIONS para CORS
  if (req.method === "OPTIONS") {
    log("Requisição OPTIONS de CORS recebida");
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  
  try {
    log("Edge function customer-portal iniciada");
    
    // Verificar token de autenticação
    log("Verificando token de autenticação");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Token de autenticação não fornecido");
    }
    
    const token = authHeader.replace("Bearer ", "");
    
    // Inicializar cliente Supabase com o token do usuário
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    
    // Obter dados do usuário autenticado
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData.user) {
      log("Erro ao autenticar usuário", userError || "Usuário não encontrado");
      throw new Error("Erro de autenticação: " + (userError?.message || "Usuário não encontrado"));
    }
    
    const user = userData.user;
    log("Usuário autenticado com sucesso", { id: user.id, email: user.email });
    
    // Verificar API key do Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      log("API key do Stripe não encontrada nas variáveis de ambiente");
      throw new Error("Configuração do servidor incompleta: Stripe API key não encontrada");
    }
    
    // Inicializar o Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });
    
    // Verificar cliente Stripe
    log("Verificando cliente Stripe para:", user.email);
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    
    if (customers.data.length === 0) {
      log("Cliente Stripe não encontrado");
      throw new Error("Nenhuma assinatura encontrada para este usuário");
    }
    
    const customerId = customers.data[0].id;
    log("Cliente Stripe encontrado:", customerId);
    
    // Obter URL de origem ou usar URL padrão
    let requestBody = {};
    try {
      requestBody = await req.json();
    } catch (e) {
      log("Corpo da requisição vazio ou inválido");
    }
    
    const returnUrl = (requestBody as any).returnUrl || 
                      Deno.env.get("SITE_URL") || 
                      req.headers.get("origin") || 
                      "http://localhost:8080/subscription";
                      
    log("URL para retorno após portal:", returnUrl);
    
    // Criar sessão do portal do cliente
    log("Criando sessão do portal do cliente");
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    
    log("Sessão do portal do cliente criada com sucesso", { id: session.id, url: session.url });
    
    // Retornar URL da sessão do portal
    return new Response(JSON.stringify({ 
      success: true,
      url: session.url 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    log("Erro ao criar sessão do portal do cliente", error.message || error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro interno ao criar sessão do portal",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
