-- ============================================================================
-- Gerador do código de convite da revendedora sem viés.
--
-- 0031 usava substr(alfabeto, floor(random() * 30) + 1, 1): o alfabeto tem 31
-- caracteres, então o último ('9') nunca era sorteado, e random() não é
-- criptográfico. Agora: bytes do gen_random_bytes (pgcrypto, schema extensions)
-- com rejeição dos valores >= 248 (= 8 * 31), o que deixa os 31 caracteres
-- equiprováveis (byte % 31 sem viés de módulo).
-- ============================================================================

create or replace function private.gerar_codigo_acesso()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 chars, sem 0/O, 1/I/L
  v_n constant int := length('ABCDEFGHJKMNPQRSTUVWXYZ23456789');
  v_limite constant int := 256 - (256 % length('ABCDEFGHJKMNPQRSTUVWXYZ23456789')); -- 248
  v_codigo text := '';
  v_bytes bytea;
  v_b int;
  i int;
begin
  while length(v_codigo) < 6 loop
    v_bytes := extensions.gen_random_bytes(16);
    for i in 0 .. length(v_bytes) - 1 loop
      v_b := get_byte(v_bytes, i);
      if v_b < v_limite then
        v_codigo := v_codigo || substr(v_alfabeto, (v_b % v_n) + 1, 1);
        exit when length(v_codigo) = 6;
      end if;
    end loop;
  end loop;
  return v_codigo;
end;
$$;
