import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  try {
    const { data, error } = await supabase
      .from('articles')
      .update({ is_read: true })
      .eq('id', id)
      .select(); // On ajoute .select() pour récupérer l'article modifié

    if (error) throw error;

    // Correction de l'erreur TypeScript : on vérifie si data existe et n'est pas vide
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });
    }

    return NextResponse.json({ success: true, article: data[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}