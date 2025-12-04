'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Recipe, RecipeIngredient, MenuItem, Item } from '@/types/database'

interface IngredientInput {
  item_id: string
  quantity: string
  unit: string
  notes: string
}

export default function RecipeManagement() {
  const [recipes, setRecipes] = useState<(Recipe & { menu_item?: MenuItem; ingredients?: RecipeIngredient[] })[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [formData, setFormData] = useState({
    menu_item_id: '',
    name: '',
    description: '',
    serving_size: '1',
    preparation_time: '',
  })
  const [ingredients, setIngredients] = useState<IngredientInput[]>([])

  useEffect(() => {
    fetchRecipes()
    fetchMenuItems()
    fetchItems()
  }, [])

  const fetchRecipes = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          menu_item:menu_items(*),
          ingredients:recipe_ingredients(*, item:items(*))
        `)
        .order('name')

      if (error) throw error
      setRecipes(data || [])
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to fetch recipes' })
    } finally {
      setLoading(false)
    }
  }

  const fetchMenuItems = async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .order('name')
    if (data) setMenuItems(data)
  }

  const fetchItems = async () => {
    const { data } = await supabase
      .from('items')
      .select('*')
      .order('name')
    if (data) setItems(data)
  }

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { item_id: '', quantity: '', unit: 'pieces', notes: '' }])
  }

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const handleIngredientChange = (index: number, field: keyof IngredientInput, value: string) => {
    const updated = [...ingredients]
    updated[index] = { ...updated[index], [field]: value }
    
    // Auto-set unit when item is selected
    if (field === 'item_id' && value) {
      const selectedItem = items.find(item => item.id === value)
      if (selectedItem) {
        updated[index].unit = selectedItem.unit
      }
    }
    
    setIngredients(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      // Validate ingredients
      const validIngredients = ingredients.filter(ing => ing.item_id && ing.quantity)
      if (validIngredients.length === 0) {
        setMessage({ type: 'error', text: 'Please add at least one ingredient' })
        setLoading(false)
        return
      }

      if (editingRecipe) {
        // Update recipe
        const { error: recipeError } = await supabase
          .from('recipes')
          .update({
            menu_item_id: formData.menu_item_id || null,
            name: formData.name,
            description: formData.description || null,
            serving_size: parseInt(formData.serving_size, 10) || 1,
            preparation_time: formData.preparation_time ? parseInt(formData.preparation_time, 10) : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRecipe.id)

        if (recipeError) throw recipeError

        // Delete existing ingredients
        await supabase
          .from('recipe_ingredients')
          .delete()
          .eq('recipe_id', editingRecipe.id)

        // Insert new ingredients
        const ingredientRecords = validIngredients.map(ing => ({
          recipe_id: editingRecipe.id,
          item_id: ing.item_id,
          quantity: parseFloat(ing.quantity),
          unit: ing.unit,
          notes: ing.notes || null,
        }))

        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredientRecords)

        if (ingredientsError) throw ingredientsError

        setMessage({ type: 'success', text: 'Recipe updated successfully!' })
      } else {
        // Create new recipe
        const { data: newRecipe, error: recipeError } = await supabase
          .from('recipes')
          .insert({
            menu_item_id: formData.menu_item_id || null,
            name: formData.name,
            description: formData.description || null,
            serving_size: parseInt(formData.serving_size, 10) || 1,
            preparation_time: formData.preparation_time ? parseInt(formData.preparation_time, 10) : null,
          })
          .select()
          .single()

        if (recipeError) throw recipeError

        // Insert ingredients
        const ingredientRecords = validIngredients.map(ing => ({
          recipe_id: newRecipe.id,
          item_id: ing.item_id,
          quantity: parseFloat(ing.quantity),
          unit: ing.unit,
          notes: ing.notes || null,
        }))

        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredientRecords)

        if (ingredientsError) throw ingredientsError

        setMessage({ type: 'success', text: 'Recipe created successfully!' })
      }

      setFormData({ menu_item_id: '', name: '', description: '', serving_size: '1', preparation_time: '' })
      setIngredients([])
      setEditingRecipe(null)
      setShowForm(false)
      fetchRecipes()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save recipe'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (recipe: Recipe & { ingredients?: RecipeIngredient[] }) => {
    setEditingRecipe(recipe)
    setFormData({
      menu_item_id: recipe.menu_item_id || '',
      name: recipe.name,
      description: recipe.description || '',
      serving_size: recipe.serving_size.toString(),
      preparation_time: recipe.preparation_time?.toString() || '',
    })
    setIngredients(
      recipe.ingredients?.map(ing => ({
        item_id: ing.item_id,
        quantity: ing.quantity.toString(),
        unit: ing.unit,
        notes: ing.notes || '',
      })) || []
    )
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recipe? This will also delete all its ingredients.')) return

    setLoading(true)
    try {
      const { error } = await supabase.from('recipes').delete().eq('id', id)
      if (error) throw error
      setMessage({ type: 'success', text: 'Recipe deleted successfully!' })
      fetchRecipes()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete recipe'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({ menu_item_id: '', name: '', description: '', serving_size: '1', preparation_time: '' })
    setIngredients([])
    setEditingRecipe(null)
    setShowForm(false)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Manage Recipes</h2>
        <button
          onClick={() => {
            setShowForm(!showForm)
            if (!showForm) {
              handleCancel()
            }
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 cursor-pointer transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add New Recipe'}
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingRecipe ? 'Edit Recipe' : 'Add New Recipe'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="menu_item" className="block text-sm font-medium text-gray-700 mb-1">
                Menu Item (optional)
              </label>
              <select
                id="menu_item"
                value={formData.menu_item_id}
                onChange={(e) => setFormData({ ...formData, menu_item_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer"
              >
                <option value="">Select a menu item (optional)</option>
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Recipe Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                placeholder="e.g., Jollof Rice Recipe"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                placeholder="Recipe description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="serving_size" className="block text-sm font-medium text-gray-700 mb-1">
                  Serving Size *
                </label>
                <input
                  id="serving_size"
                  type="number"
                  step="1"
                  min="1"
                  value={formData.serving_size}
                  onChange={(e) => setFormData({ ...formData, serving_size: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                  placeholder="1"
                />
                <p className="mt-1 text-xs text-gray-500">Number of servings this recipe makes</p>
              </div>

              <div>
                <label htmlFor="preparation_time" className="block text-sm font-medium text-gray-700 mb-1">
                  Preparation Time (minutes, optional)
                </label>
                <input
                  id="preparation_time"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.preparation_time}
                  onChange={(e) => setFormData({ ...formData, preparation_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Ingredients *</label>
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  className="text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  + Add Ingredient
                </button>
              </div>
              {ingredients.length === 0 && (
                <p className="text-sm text-gray-500 mb-2">No ingredients added. Click "Add Ingredient" to add items.</p>
              )}
              {ingredients.map((ingredient, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 mb-2 items-end">
                  <div className="col-span-4">
                    <select
                      value={ingredient.item_id}
                      onChange={(e) => handleIngredientChange(index, 'item_id', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer text-sm"
                    >
                      <option value="">Select item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={ingredient.quantity}
                      onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)}
                      required
                      placeholder="Qty"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={ingredient.unit}
                      onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)}
                      required
                      placeholder="Unit"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={ingredient.notes}
                      onChange={(e) => handleIngredientChange(index, 'notes', e.target.value)}
                      placeholder="Notes"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black text-sm"
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      type="button"
                      onClick={() => handleRemoveIngredient(index)}
                      className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 cursor-pointer text-sm"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {loading ? 'Saving...' : editingRecipe ? 'Update Recipe' : 'Create Recipe'}
            </button>
          </form>
        </div>
      )}

      {loading && !showForm ? (
        <div className="text-center py-8">Loading recipes...</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipe Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Menu Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Serving Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ingredients
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recipes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No recipes found. Add your first recipe to get started.
                    </td>
                  </tr>
                ) : (
                  recipes.map((recipe) => (
                    <tr key={recipe.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {recipe.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {recipe.menu_item?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {recipe.serving_size} serving{recipe.serving_size !== 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {recipe.ingredients && recipe.ingredients.length > 0 ? (
                          <div className="space-y-1">
                            {recipe.ingredients.map((ing) => (
                              <div key={ing.id}>
                                {ing.quantity} {ing.unit} {ing.item?.name || 'Unknown'}
                              </div>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(recipe)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(recipe.id)}
                          className="text-red-600 hover:text-red-900 cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

