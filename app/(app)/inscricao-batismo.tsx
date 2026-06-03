import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormScaffold } from "@/components/inscricoes/FormScaffold";
import { useAuth } from "@/contexts/AuthContext";
import { useMembro } from "@/lib/useMembro";
import { criarInscricao } from "@/lib/inscricoes";
import { dateBRToISO, isValidDateBR, maskDateBR } from "@/lib/validators";

export default function InscricaoBatismoScreen() {
  const { user } = useAuth();
  const { membro, loading } = useMembro();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [camisa, setCamisa] = useState("");
  const [deficiencia, setDeficiencia] = useState(false);
  const [deficienciaDesc, setDeficienciaDesc] = useState("");
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (membro) {
      setNome((v) => v || membro.nome);
      setTelefone((v) => v || membro.telefone);
      setEmail((v) => v || membro.email);
    }
  }, [membro]);

  async function enviar() {
    setError(null);
    if (!nome || !telefone) {
      setError("Preencha pelo menos nome e telefone.");
      return;
    }
    if (nascimento && !isValidDateBR(nascimento)) {
      setError("Data de nascimento inválida (DD/MM/AAAA).");
      return;
    }
    setEnviando(true);
    try {
      const partes = nome.trim().split(/\s+/);
      await criarInscricao(
        "batismo",
        {
          nome: partes[0],
          sobrenome: partes.slice(1).join(" "),
          telefone: telefone.trim(),
          email: email.trim() || null,
          data_nascimento: nascimento ? dateBRToISO(nascimento) : null,
          tamanho_camisa: camisa.trim() || null,
          possui_deficiencia: deficiencia,
          deficiencia_descricao: deficiencia ? deficienciaDesc.trim() || null : null,
          observacoes: obs.trim() || null,
          cpf: membro?.cpf || null,
          membro_id: membro?.membroId ?? null,
        },
        user?.id
      );
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <FormScaffold
      title="Batismo"
      subtitle="Inscreva-se para ser batizado(a) na CBRio."
      icon="water"
      submitLabel="Quero me batizar"
      onSubmit={enviar}
      submitting={enviando || loading}
      enviado={enviado}
      error={error}
    >
      <Input label="Nome completo" value={nome} onChangeText={setNome} autoCapitalize="words" />
      <Input label="Telefone" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" placeholder="+55 21 99999-9999" />
      <Input label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Input
        label="Data de nascimento (opcional)"
        value={nascimento}
        onChangeText={(t) => setNascimento(maskDateBR(t))}
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        maxLength={10}
      />
      <Input label="Tamanho da camisa (opcional)" value={camisa} onChangeText={setCamisa} placeholder="P / M / G / GG" />
      <Checkbox
        checked={deficiencia}
        onChange={setDeficiencia}
        label="Possui alguma deficiência ou limitação física?"
      />
      {deficiencia && (
        <Input
          label="Descreva a limitação"
          value={deficienciaDesc}
          onChangeText={setDeficienciaDesc}
          placeholder="Conte como podemos te ajudar"
        />
      )}
      <Input label="Observações (opcional)" value={obs} onChangeText={setObs} />
    </FormScaffold>
  );
}
